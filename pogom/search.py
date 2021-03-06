#!/usr/bin/python
# -*- coding: utf-8 -*-

import logging
import time
import math
from datetime import datetime

from pgoapi.utilities import f2i, get_cellid, get_pos_by_name
from models import Player

from . import config
from .models import parse_map

log = logging.getLogger(__name__)

TIMESTAMP = '\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000'

#Constants for Hex Grid
#Gap between vertical and horzonal "rows"
lat_gap_meters = 150
lng_gap_meters = 86.6

#111111m is approx 1 degree Lat, which is close enough for this
meters_per_degree = 111111
lat_gap_degrees = float(lat_gap_meters) / meters_per_degree

def calculate_lng_degrees(lat):
    return float(lng_gap_meters) / (meters_per_degree * math.cos(math.radians(lat)))


def send_map_request(api, position):
    try:
        api.set_position(*position)
        api.get_map_objects(latitude=f2i(position[0]),
                            longitude=f2i(position[1]),
                            since_timestamp_ms=TIMESTAMP,
                            cell_id=get_cellid(position[0], position[1]))
        return api.call()
    except Exception as e:
        log.warn("Uncaught exception when downloading map " + str(e))
        return False


def generate_location_steps(initial_location, num_steps):

    ring = 1 #Which ring are we on, 0 = center
    lat_location = initial_location[0]
    lng_location = initial_location[1]

    yield (initial_location[0],initial_location[1], 0) #Middle circle

    while ring < num_steps:
        #Move the location diagonally to top left spot, then start the circle which will end up back here for the next ring 
        #Move Lat north first
        lat_location += lat_gap_degrees
        lng_location -= calculate_lng_degrees(lat_location)

        for direction in range(6):
            for i in range(ring):
                _lat, _lng = lat_location, lng_location
                if direction == 0: #Right
                    lng_location += calculate_lng_degrees(lat_location) * 2

                if direction == 1: #Right Down
                    lat_location -= lat_gap_degrees
                    lng_location += calculate_lng_degrees(lat_location)

                if direction == 2: #Left Down
                    lat_location -= lat_gap_degrees
                    lng_location -= calculate_lng_degrees(lat_location)

                if direction == 3: #Left
                    lng_location -= calculate_lng_degrees(lat_location) * 2

                if direction == 4: #Left Up
                    lat_location += lat_gap_degrees
                    lng_location -= calculate_lng_degrees(lat_location)

                if direction == 5: #Right Up
                    lat_location += lat_gap_degrees
                    lng_location += calculate_lng_degrees(lat_location)

                STEP_REDUCTION = 1 # no reduction
                for i in range(STEP_REDUCTION):
                    yield (
                        i * 1.0 / STEP_REDUCTION * lat_location + (STEP_REDUCTION - i) * 1.0  / STEP_REDUCTION * _lat,
                        i * 1.0 / STEP_REDUCTION * lng_location + (STEP_REDUCTION - i) * 1.0  / STEP_REDUCTION * _lng,
                        0
                    ) #Middle circle

        ring += 1


def login(args, position):
    log.info('Attempting login to Pokemon Go.')
    api = args.api
    api.set_position(*position)

    while not api.login(args.auth_service, args.username, args.password):
        log.info('Failed to login to Pokemon Go. Trying again.')
        time.sleep(config['REQ_SLEEP'])

    log.info('Login to Pokemon Go successful.')

def get_player_id(args):
    return args.username + args.auth_service

def initialize_player_position(args):
    player_id = get_player_id(args)
    start_position = get_pos_by_name(args.location)

    if len(Player.select().where(Player.player_id == player_id)) == 0:
        Player.create(
            player_id=player_id,
            name=args.username,
            enabled=True,
            last_modified=datetime.now(),
            start_latitude=start_position[0],
            start_longitude=start_position[1]
        )
    else:
        Player.update(
            last_modified=datetime.now(),
            start_latitude=start_position[0],
            start_longitude=start_position[1]
        ).where(Player.player_id == player_id).execute()

def update_player_position(args, latitude, longitude):
    player_id = get_player_id(args)
    Player.update(
        latitude=latitude,
        longitude=longitude,
        last_modified=datetime.now()
    ).where(Player.player_id == player_id).execute()

def almost_equals(a, b):
    return abs(a - b) < 0.00000001

def player_has_reset_initial_position(args):
    player_id = get_player_id(args)
    player = Player.select().where(Player.player_id == player_id)[0]
    start_position = get_pos_by_name(args.location)
    return not (almost_equals(player.start_latitude, start_position[0]) and almost_equals(player.start_longitude, start_position[1]))

def search(args, i):
    num_steps = args.step_limit
    total_steps = (3 * (num_steps**2)) - (3 * num_steps) + 1

    position = get_pos_by_name(args.location)
    position = (position[0], position[1], 0)

    api = args.api
    if api._auth_provider and api._auth_provider._ticket_expire:
        remaining_time = api._auth_provider._ticket_expire/1000 - time.time()

        if remaining_time > 60:
            log.info("Skipping Pokemon Go login process since already logged in for another {:.2f} seconds".format(remaining_time))
        else:
            login(args, position)
    else:
        login(args, position)

    for step, step_location in enumerate(generate_location_steps(position, num_steps), 1):
        log.info('Scanning step {:d} of {:d}.'.format(step, total_steps))
        log.info('Scan location is {:f}, {:f}'.format(step_location[0], step_location[1]))
        update_player_position(args, step_location[0], step_location[1])

        response_dict = {}
        failed_consecutive = 0
        while not response_dict:
            if player_has_reset_initial_position(args):
                # we stop this loop and start another one
                player_id = get_player_id(args)
                player = Player.select().where(Player.player_id == player_id)[0]
                args.location = str(player.start_latitude) + ' ' + str(player.start_longitude)
                search_loop(args)
                return

            response_dict = send_map_request(api, step_location)
            if response_dict:
                try:
                    parse_map(response_dict, i, step, step_location)
                except KeyError:
                    log.error('Scan step {:d} failed. Response dictionary key error.'.format(step))
                    failed_consecutive += 1
                    if(failed_consecutive >= config['REQ_MAX_FAILED']):
                        log.error('Niantic servers under heavy load. Waiting before trying again')
                        time.sleep(config['REQ_HEAVY_SLEEP'])
                        failed_consecutive = 0
            else:
                log.info('Map Download failed. Trying again.')

        log.info('Completed {:5.2f}% of scan.'.format(float(step) / num_steps**2*100))
        time.sleep(config['REQ_SLEEP'])
    return True


def search_loop(args):
    i = 0
    initialize_player_position(args)
    try:
        should_continue = True
        while should_continue:
            log.info("Map iteration: {}".format(i))
            should_continue = search(args, i)
            log.info("Scanning complete.")
            if args.scan_delay > 1:
                log.info('Waiting {:d} seconds before beginning new scan.'.format(args.scan_delay))
            i += 1

    # This seems appropriate
    except:
        log.info('Crashed, waiting {:d} seconds before restarting search.'.format(args.scan_delay))
        time.sleep(args.scan_delay)
        search_loop(args)

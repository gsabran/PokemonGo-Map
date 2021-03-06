#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import logging
import time
import json
import random

from threading import Thread
from flask_cors import CORS, cross_origin

from pogom import config
from pogom.app import Pogom
from pogom.utils import get_args, insert_mock_data, load_credentials, FakeArgs
from pogom.search import search_loop
from pogom.models import create_tables, Pokemon, Pokestop, Gym
from pogom.pgoapi import PGoApi

from pogom.pgoapi.utilities import get_pos_by_name

log = logging.getLogger(__name__)

search_thread = Thread()

def start_locator_thread(args):
    api = PGoApi()
    args.api = api
    search_thread = Thread(target=search_loop, args=(args,))
    search_thread.daemon = True
    search_thread.name = 'search_thread'
    search_thread.start()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(module)11s] [%(levelname)7s] %(message)s')

    logging.getLogger("peewee").setLevel(logging.INFO)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("pogom.pgoapi.pgoapi").setLevel(logging.WARNING)
    logging.getLogger("pogom.pgoapi.rpc_api").setLevel(logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    args = get_args()

    if args.debug:
        logging.getLogger("requests").setLevel(logging.DEBUG)
        logging.getLogger("pgoapi").setLevel(logging.DEBUG)
        logging.getLogger("rpc_api").setLevel(logging.DEBUG)

    create_tables()

    position = get_pos_by_name(args.location)
    if not any(position):
        log.error('Could not get a position by name, aborting.')
        sys.exit()

    log.info('Parsed location is: {:.4f}/{:.4f}/{:.4f} (lat/lng/alt)'.
             format(*position))

    config['ORIGINAL_LATITUDE'] = position[0]
    config['ORIGINAL_LONGITUDE'] = position[1]
    config['LOCALE'] = args.locale

    if not args.mock:
        print(args.location)
        start_locator_thread(args)
        _additional_accounts = os.environ.get('POK_ACCOUNT')
        if _additional_accounts is not None:
            additional_accounts = json.loads(_additional_accounts)
            for fake_account in additional_accounts:
                time.sleep(1)
                fake_args = FakeArgs({
                    'location': str(position[0] + (random.random() - 0.5) * 0.04) + ' ' + str(position[1] + (random.random() - 0.5) * 0.04),
                    'username': fake_account[0],
                    'password': fake_account[2],
                    'auth_service': 'ptc',
                    'step_limit': int(os.environ.get('POK_STEP_LIMIT')),
                })
                start_locator_thread(fake_args)
    else:
        insert_mock_data()

    app = Pogom(__name__)

    if args.cors:
        CORS(app);

    config['ROOT_PATH'] = app.root_path
    if args.gmaps_key is not None:
        config['GMAPS_KEY'] = args.gmaps_key
    else:
        config['GMAPS_KEY'] = load_credentials(os.path.dirname(os.path.realpath(__file__)))['gmaps_key']

    if args.no_server:
        while not search_thread.isAlive():
            time.sleep(1)
        search_thread.join()
    else:
        app.run(threaded=True, debug=args.debug, host=args.host, port=args.port)

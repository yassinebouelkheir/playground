// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const createTestEnvironment = require('features/houses/test/test_environment.js');

// Zero-based index of the Property Settings menu in the `/house settings` options.
const SETTINGS_MENU_INDEX = 2;

describe('Pickups', (it, beforeEach) => {
    let gunther = null;
    let location = null;
    let manager = null;

    beforeEach(async(assert) => {
        gunther = server.playerManager.getById(0 /* Gunther */);
        gunther.identify({ userId: 42 });

        ({ manager } = await createTestEnvironment());

        // The `/house settings` command is only available when the player is in a house.
        manager.forceEnterHouse(
            gunther, await manager.findClosestLocation(gunther, { ignoreAvailable: true }));

        location = manager.getCurrentHouseForPlayer(gunther);

        assert.isNotNull(location);
        assert.isFalse(location.isAvailable());
    });

    // TODO: Write tests for the pickup feature.
});
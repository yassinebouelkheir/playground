// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const Economy = require('features/economy/economy.js');
const HouseCommands = require('features/houses/house_commands.js');
const HouseManager = require('features/houses/house_manager.js');
const MockAnnounce = require('features/announce/test/mock_announce.js');
const MockHouseDatabase = require('features/houses/test/mock_house_database.js');
const ParkingLotCreator = require('features/houses/utils/parking_lot_creator.js');

describe('HouseCommands', (it, beforeEach, afterEach) => {
    let commands = null;
    let manager = null;

    beforeEach(() => {
        const announce = new MockAnnounce();
        const economy = new Economy();

        manager = new HouseManager(() => economy);
        manager.database_ = new MockHouseDatabase();

        commands = new HouseCommands(manager, () => announce, () => economy);
    });

    afterEach(() => {
        if (commands)
            commands.dispose();

        manager.dispose();
    });

    it('should only be available for Management members', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        assert.isTrue(await gunther.issueCommand('/house'));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0],
            Message.format(Message.COMMAND_ERROR_INSUFFICIENT_RIGHTS,
                           playerLevelToString(Player.LEVEL_MANAGEMENT, true /* plural */)));

        gunther.clearMessages();
        gunther.level = Player.LEVEL_MANAGEMENT;

        assert.isTrue(await gunther.issueCommand('/house'));
        assert.equal(gunther.messages.length, 4);
        assert.equal(gunther.messages[0], Message.HOUSE_HEADER);
    });

    it('should allow for creation of house locations', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;

        gunther.respondToDialog({ response: 1 /* Yes, confirm creation of the house */ });

        assert.equal(manager.locationCount, 0);

        assert.isTrue(await gunther.issueCommand('/house create'));

        assert.equal(gunther.messages.length, 1);
        assert.isTrue(
            gunther.messages[0].includes(
                Message.format(Message.HOUSE_ANNOUNCE_CREATED, gunther.name, gunther.id)));

        assert.equal(manager.locationCount, 1);
    });

    it('should prevent houses from being created in residential exclusion zones', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(2000, 1567, 15);  // on the pirate ship

        gunther.respondToDialog({ response: 0 /* Accept that the house cannot be created */ });

        assert.isTrue(await gunther.issueCommand('/house create'));

        assert.equal(gunther.messages.length, 0);
        assert.equal(gunther.lastDialog, Message.HOUSE_CREATE_RESIDENTIAL_EXCLUSION_ZONE);
    })

    it('should issue an error when trying to modify a non-existing house', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;

        assert.isTrue(await gunther.issueCommand('/house modify'));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.HOUSE_MODIFY_NONE_NEAR);
    });

    it('should display an identity beam when modifying a nearby house', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);
        const objectCount = server.objectManager.count;

        await manager.loadHousesFromDatabase();

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        assert.isTrue(gunther.issueCommand('/house modify'));
        await manager.findClosestLocation(gunther);

        assert.equal(gunther.messages.length, 0);

        assert.equal(server.objectManager.count, objectCount + 2);

        await server.clock.advance(180000);  // forward the clock to test the auto-expire function

        assert.equal(server.objectManager.count, objectCount);
    });

    it('should enable administrators to remove house locations', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        gunther.respondToDialog({ listitem: 2 /* Delete the location */ }).then(
            () => gunther.respondToDialog({ response: 1 /* Yes, really get rid of it */ }));

        assert.isTrue(await gunther.issueCommand('/house modify'));

        assert.equal(manager.locationCount, 2);
    });

    it('should enable administrators to add a parking lot', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        gunther.respondToDialog({ listitem: 0 /* Add a parking lot */ }).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ })).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ }));

        const location = await manager.findClosestLocation(gunther);
        assert.equal(location.parkingLotCount, 0);

        const commandPromise = gunther.issueCommand('/house modify');

        // Extend the ParkingLotCreator class so that we can fake the Gunther being in a vehicle.
        commands.parkingLotCreator_ = new class extends ParkingLotCreator {
            getCurrentVehiclePosition(player) {
                return location.position.translate({ x: 10, y: 10 });
            }
            getCurrentVehicleRotation(player) {
                return 90;
            }
        };

        while (!commands.parkingLotCreator_.isSelecting(gunther))
            await Promise.resolve();

        commands.parkingLotCreator_.confirmSelection(gunther);

        assert.isTrue(await commandPromise);

        assert.equal(location.parkingLotCount, 1);

        const parkingLot = Array.from(location.parkingLots)[0];
        assert.isAbove(parkingLot.id, 0);
        assert.deepEqual(parkingLot.position, location.position.translate({ x: 10, y: 10 }));
        assert.equal(parkingLot.rotation, 90);
    });

    it('should cancel adding a parking lot when using `/house cancel`', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        gunther.respondToDialog({ listitem: 0 /* Add a parking lot */ }).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ })).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ }));

        const commandPromise = gunther.issueCommand('/house modify');

        while (!commands.parkingLotCreator_.isSelecting(gunther))
            await Promise.resolve();

        assert.isTrue(await gunther.issueCommand('/house cancel'));
        assert.isTrue(await commandPromise);
    });

    it('should fail when trying to remove parking lots when there are none', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        gunther.respondToDialog({ listitem: 1 /* Remove a parking lot */ }).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ }));

        assert.isTrue(await gunther.issueCommand('/house modify'));
        assert.isFalse(commands.parkingLotRemover_.isSelecting(gunther));
    });

    it('should be able to remove parking lots from a location', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        // TODO: Make sure that there's at least a parking lot for the location.

        gunther.respondToDialog({ listitem: 1 /* Remove a parking lot */ }).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ }));

        const commandPromise = gunther.issueCommand('/house modify');

        // TODO: Assert that passing in an invalid Id will give the administrator another chance.
        // TODO: Pass in a valid Id with `/house remove [id]`.

        assert.isTrue(await commandPromise);

        // TODO: Assert that the parking lot has been removed.
    });

    it('should cancel removing a parking lot when using `/house cancel`', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.identify();
        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 240, 300);  // 10 units from the nearest location

        const location = await manager.findClosestLocation(gunther);

        await manager.createLocationParkingLot(gunther, location, {
            position: new Vector(220, 250, 300),
            rotation: 90
        });

        assert.equal(location.parkingLotCount, 1);

        gunther.respondToDialog({ listitem: 1 /* Remove a parking lot */ }).then(
            () => gunther.respondToDialog({ response: 0 /* Yes, I get it */ }));

        const commandPromise = gunther.issueCommand('/house modify');

        while (!commands.parkingLotRemover_.isSelecting(gunther))
            await Promise.resolve();

        assert.isTrue(await gunther.issueCommand('/house cancel'));
        assert.isTrue(await commandPromise);

        assert.equal(location.parkingLotCount, 1);
    });

    it('should not allow buying a house when the player is not standing in one', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.level = Player.LEVEL_MANAGEMENT;

        assert.isTrue(await gunther.issueCommand('/house buy'));

        assert.equal(gunther.messages.length, 1);
        assert.equal(gunther.messages[0], Message.HOUSE_BUY_NO_LOCATION);
    });

    it('should not allow buying a house when the player already has one', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        await manager.loadHousesFromDatabase();
        assert.isAbove(manager.locationCount, 0);

        gunther.level = Player.LEVEL_MANAGEMENT;
        gunther.position = new Vector(200, 250, 300);  // on the nearest location pickup

        manager.getHouseForPlayer = player => true;  // any non-NULL value will do

        assert.isTrue(await gunther.issueCommand('/house buy'));

        assert.equal(gunther.messages.length, 2);
        assert.equal(gunther.messages[1], Message.HOUSE_BUY_NO_MULTIPLE);
    });

    it('should clean up after itself', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);

        assert.isTrue(await gunther.issueCommand('/house'));

        commands.dispose();
        commands = null;

        assert.isFalse(await gunther.issueCommand('/house'));
    });
});

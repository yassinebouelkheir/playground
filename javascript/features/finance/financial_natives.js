// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// Wrapper for any native Pawn function calls the disposition monitor has to make, to make sure that
// these can be overridden by the JavaScript testing routines.
export class FinancialNativeCalls {
    getPlayerMoney(player) {
        return pawnInvoke('GetPlayerMoney', 'i', player.id);
    }
    givePlayerMoney(player, amount) {
        pawnInvoke('GivePlayerMoney', 'ii', player.id, amount);
    }
}

// Responsible for providing players with the ability to interact with the financial regulator and
// supporting services, by introducing a series of commands.
export class FinancialNatives {
    constructor(regulator) {
        this.regulator_ = regulator;

        provideNative(
            'GetPlayerMoneyJS', 'i', FinancialNatives.prototype.getPlayerMoney.bind(this));
        provideNative(
            'GivePlayerMoneyJS', 'ii', FinancialNatives.prototype.givePlayerMoney.bind(this));
        provideNative(
            'ResetPlayerMoneyJS', 'i', FinancialNatives.prototype.resetPlayerMoney.bind(this));
        provideNative(
            'DepositToAccountJS', 'ii', FinancialNatives.prototype.depositToAccount.bind(this));
    }

    // native GetPlayerMoneyJS(playerid);
    getPlayerMoney(playerid) {
        const player = server.playerManager.getById(playerid);
        return player ? this.regulator_.getPlayerCashAmount(player)
                      : 0;
    }

    // native GivePlayerMoneyJS(playerid, amount);
    givePlayerMoney(playerid, amount) {
        const player = server.playerManager.getById(playerid);
        if (!player)
            return 0;
        
        // TODO: Display the MoneyIndicator once ported from Pawn.

        this.regulator_.setPlayerCashAmount(
            player, this.regulator_.getPlayerCashAmount(player) + amount);
        
        return 0;
    }

    // native ResetPlayerMoneyJS(playerid);
    resetPlayerMoney(playerid) {
        const player = server.playerManager.getById(playerid);
        if (player)
            this.regulator_.setPlayerCashAmount(player, 0);
        
        return 0;
    }

    // native DepositToAccountJS(playerid, amount);
    depositToAccount(playerid, amount) {
        const player = server.playerManager.getById(playerid);
        if (player)
            this.regulator_.depositToAccount(player, amount);
        
        return 0;
    }

    dispose() {
        provideNative('DepositToAccountJS', 'ii', () => 0);
        provideNative('GetPlayerMoneyJS', 'i', () => 0);
        provideNative('GivePlayerMoneyJS', 'ii', () => 0);
        provideNative('ResetPlayerMoneyJS', 'i', () => 0);
    }
}

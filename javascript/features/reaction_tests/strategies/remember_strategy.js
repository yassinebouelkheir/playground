// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { Strategy } from 'features/reaction_tests/strategy.js';

// This strategy works by asking players to remember a sequence of digits for a minute or two, after
// which they'll be asked to repeat it. Another good way to train players' memories.
export class RememberStrategy extends Strategy {
    // How many players should be on the server in order to consider this strategy?
    static kMinimumPlayerCount = 15;

    // Minimum and maximum numbers that will be generated by this strategy.
    static kMinimumNumber = 6000;
    static kMaximumNumber = 115000;

    // States that the remember strategy can be in.
    static kStateUninitialized = 0;
    static kStateWaiting = 1;
    static kStateActive = 2;
    static kStateStopped = 3;
    
    answer_ = null;
    answerOffsetTimeMs_ = null;
    settings_ = null;
    state_ = RememberStrategy.kStateUninitialized;
    
    constructor(settings) {
        super();

        this.settings_ = settings;
    }

    // Gets the answer to the current reaction test. May be NULL.
    get answer() { return this.answer_; }

    // Time, in milliseconds, to offset the player's actual answer time with.
    get answerOffsetTimeMs() { return this.answerOffsetTimeMs_; }

    // Starts a new test provided by this strategy. The question must be determined, and it should
    // be announced to people in-game and available through Nuwani accordingly.
    start(announceFn, nuwani, prize) {
        this.answer_ =
            this.randomInteger(RememberStrategy.kMinimumNumber, RememberStrategy.kMaximumNumber);

        // Announce the test to all in-game participants.
        announceFn(Message.REACTION_TEST_ANNOUNCE_REMEMBER, this.answer_);

        // Announce the test to everyone reading along through Nuwani.
        nuwani().echo('reaction-remember', prize);

        // Now wait for a certain amount of time before enabling people to share the answer.
        const delay = this.settings_().getValue('playground/reaction_test_remember_delay_sec');
        const jitter = this.settings_().getValue('playground/reaction_test_remember_jitter_sec');

        this.answerOffsetTimeMs_ = this.randomInteger(delay - jitter, delay + jitter) * 1000;
        wait(this.answerOffsetTimeMs_).then(() => {
            if (this.state_ != RememberStrategy.kStateWaiting)
                return;  // the test has been stopped
            
            // Announce the test to all in-game participants.
            announceFn(Message.REACTION_TEST_ANNOUNCE_REMEMBER_2, prize);

            // Announce the test to everyone reading along through Nuwani.
            nuwani().echo('reaction-remember-2', prize);

            // Formally open for answers.
            this.state_ = RememberStrategy.kStateActive;
        });
        
        this.state_ = RememberStrategy.kStateWaiting;
    }

    // Verifies whether the |message| is, or contains, the answer to this reaction test.
    verify(message) {
        if (this.state_ !== RememberStrategy.kStateActive)
            return false;

        return message.replace(/,/g, '') == this.answer_.toString();
    }

    // Called when the strategy is no longer relevant. Optional to implement.
    stop() {
        this.state_ = RememberStrategy.kStateStopped;
    }

    // Returns a random integer between the given |min| (inclusive) and |max| (exclusive).
    randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
}

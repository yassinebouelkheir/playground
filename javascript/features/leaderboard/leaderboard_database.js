// Copyright 2020 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

import { Color } from "base/color.js";

// Query to compute the leaderboard entries for damage-based ranking.
const kDamageLeaderboardQuery = `
    SELECT
        users.username,
        IF(users_gangs.user_use_gang_color = 1,
            IFNULL(gangs.gang_color, users_mutable.custom_color),
            users_mutable.custom_color) AS color,
        SUM(session_damage_given) AS damage_given,
        SUM(session_damage_taken) AS damage_taken,
        SUM(session_duration) AS duration,
        (SUM(session_shots_hit) + SUM(session_shots_missed)) AS shots
    FROM
        sessions
    LEFT JOIN
        users ON users.user_id = sessions.user_id
    LEFT JOIN
        users_mutable ON users_mutable.user_id = sessions.user_id
    LEFT JOIN
        users_gangs ON users_gangs.user_id = sessions.user_id AND users_gangs.left_gang IS NULL
    LEFT JOIN
        gangs ON gangs.gang_id = users_gangs.gang_id AND gangs.gang_color IS NOT NULL
    WHERE
        session_date >= DATE_SUB(NOW(), INTERVAL ? DAY) AND
        users.username IS NOT NULL
    GROUP BY
        sessions.user_id
    ORDER BY
        damage_given DESC
    LIMIT
        ?`;

// Retrieves leaderboard information from the database and makes it available to JavaScript in an
// intuitive and idiomatic manner. Not safe for testing, use MockLeaderboardDatabase instead.
export class LeaderboardDatabase {
    // Gets the leaderboard data when sorting players by amount of damage done.
    async getDamageLeaderboard({ days, limit }) {
        const results = await this._getDamageLeaderboardQuery({ days, limit });
        const leaderboard = [];

        for (const result of results) {
            leaderboard.push({
                nickname: result.username,
                color: result.color !== 0 ? Color.fromNumberRGBA(result.color) : null,

                damageGiven: result.damage_given,
                damageTaken: result.damage_taken,

                duration: result.duration,
                shots: result.shots,
            });
        }

        return leaderboard;
    }

    // Actually executes the query for getting the damage-based leaderboard.
    async _getDamageLeaderboardQuery({ days, limit }) {
        const results = await server.database.query(kDamageLeaderboardQuery, days, limit);
        return results && results.rows ? results.rows : [];
    }
}
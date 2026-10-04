# Player condition, fatigue and rest

Touchline tracks a player's immediate condition separately from accumulated fatigue. Condition describes how ready the player is to perform now. Fatigue records the strain of recent appearances and can remain elevated even when the condition bar has recovered. An injury is a separate event that makes a player unavailable until treatment is complete.

These are game parameters, not medical assessments of real players. The displayed risk is a relative simulation indicator, not a clinical probability or a promise that an injury will occur.

## Managing the squad

Check the readiness warnings when selecting the starting eleven and substitutes. A player can need rest because of low condition, accumulated fatigue, a short recovery period or repeated appearances. Recent workload shows minutes over the last seven and fourteen days, including club matches, friendlies and national-team appearances recorded by this career.

Warnings help the manager decide when to rotate. A healthy but tired player remains selectable; the game does not force a rest day or block kick-off solely because of fatigue. Existing injury, suspension and registration restrictions still apply.

During a match, the readiness display also accounts for minutes and tactical effort in that match. A tiring player may need a substitute even if the pre-match condition was good. Players can suffer an injury during play and be unable to continue. Replacing an injured or exhausted player still uses the match's normal substitution rules.

Live playback pauses when a player in your team is injured or their condition falls below 60%, so you can review the situation and open tactics. The severe-fatigue alert appears once per player per match. You decide whether to substitute a tired player, lower the intensity or resume play with the same lineup.

## Recovery and subsequent matches

Recovery follows elapsed dates in the career. Club and international events are processed in date order through the same recovery system, so national-team duty cannot grant an extra recovery allowance on top of normal recovery. Opening a player profile, changing screens, saving or loading does not grant recovery. An unused substitute does not accumulate match minutes simply by being on the bench.

Light training prioritizes recovery; normal training balances recovery and development; heavy training leaves less recovery between games. Staff assigned to recovery can improve it. Frequent matches give players fewer days to recover and add to accumulated fatigue. The same system applies to AI clubs and follows a player after a transfer.

In-match injury risk responds to condition, accumulated fatigue and recent workload. The result remains random: a fresh player can be injured, and a fatigued player may finish a match without injury. Tactical intensity and minutes played influence physical effort. Rest recommendations describe the current state and may change if the player plays again or the training intensity changes.

The warning thresholds are game rules:

- Recommend rest below **75% condition**, at **35/100 accumulated fatigue**, or after **240 minutes in seven days**.
- Also warn when the previous appearance lasted at least 60 minutes, was at most two days ago, and current condition is below 90%.
- Flag high risk below **60% condition** or at **60/100 accumulated fatigue**. An injured player receives an injury warning instead of advice to play through it.
- Suggested rest ranges from **one to fourteen days**, targeting 90% condition and fatigue below 15 under normal recovery assumptions. It is not the injury treatment period or a guaranteed return date.

The recent workload totals cover recorded appearances in the seven or fourteen days ending on the displayed date. Live condition additionally accounts for the match in progress; the appearance joins the history when that match is settled. Recovery is credited once per elapsed date and match load once per fixture/player. Goalkeepers receive half the physical workload of outfield players in this simplified model.

## Saved games

Condition, fatigue and recent appearance records are included in the career save. The system retains up to 24 appearances from the last 35 days for physical calculations; it does not replace the player's season statistics. Existing careers receive the new system when loaded, retaining their current condition and injuries. The upgrade does not invent appearances or fatigue history for matches played before the system was introduced. Recent-load figures become more informative as new fixtures are recorded.

// Public first-team staff snapshots reviewed on 2026-10-03.
// This is intentionally partial. Missing roles are filled by clearly labelled
// simulated staff in staff.mjs, never by guessing a real person's employment.
// sourceRole preserves the published title where the game's broader role differs.
const checkedAt = '2026-10-03'
const staff = (clubId, sourceUrl, sourceLabel, people) => people.map(([name, role, sourceRole]) => ({
  clubId, name, role, sourceUrl, sourceLabel, checkedAt,
  ...(sourceRole ? { sourceRole } : {}),
}))

export const OFFICIAL_STAFF = [
  ...staff('e359', 'https://www.premierleague.com/en/news/293167', 'Premier League · Arsenal Club Directory', [
    ['Albert Stuivenberg', 'assistant', 'Assistant Coach'],
    ['Andrea Berta', 'sportingDirector', 'Sporting Director'],
    ['Pascal De Maesschalck', 'youthDirector', 'Academy Director'],
    ['Arnaldo Abrantes', 'headDoctor', 'Head of Medical Services'],
  ]),
  ...staff('e359', 'https://www.premierleague.com/en/news/4662274/how-mikel-arteta-changed-arsenal-culture-and-turned-them-into-premier-league-champions', 'Premier League · Arsenal coaching team', [
    ['Gabriel Heinze', 'coach', 'First-team coach'],
    ['Nicolas Jover', 'coach', 'Set-piece coach'],
    ['Iñaki Caña', 'goalkeepingCoach', 'Goalkeeping coach'],
  ]),

  ...staff('e83', 'https://www.fcbarcelona.com/en/football/first-team/players', 'FC Barcelona · First-team coaching staff', [
    ['Marcus Sorg', 'assistant', 'Assistant coach'],
    ['Toni Tapalovic', 'assistant', 'Assistant coach'],
    ['Heiko Westermann', 'assistant', 'Assistant coach'],
    ['José Ramón de la Fuente', 'goalkeepingCoach', 'Goalkeeping coach'],
    ['Pepe Conde', 'fitnessCoach', 'Field fitness coach'],
    ['Benjamin Kugel', 'fitnessCoach', 'Gym and strength fitness coach'],
  ]),
  ...staff('e83', 'https://www.fcbarcelona.com/en/club/sporting-management/football', 'FC Barcelona · Sporting Management', [
    ['Deco', 'sportingDirector', 'Director of Football'],
    ['José Ramón Alexanco', 'youthDirector', 'Youth Football General Manager'],
    ['João Pedro Amaral', 'scout', 'Director of Scouting'],
  ]),

  ...staff('e364', 'https://www.liverpoolfc.com/team/mens', 'Liverpool FC · Men’s first-team staff', [
    ['Pablo de la Torre', 'assistant', 'Assistant coach'],
    ['Tommy Elphick', 'coach', 'First-team coach'],
    ['Shaun Cooper', 'coach', 'First-team coach'],
    ['Alejandro Rosalen', 'goalkeepingCoach', 'First-team goalkeeping coach'],
    ['Colin Stewart', 'goalkeepingCoach', 'Goalkeeper development and pathway lead'],
    ['Jonathan Power', 'headDoctor', 'Director of Medicine and Performance'],
    ['Amit Pannu', 'doctor', 'First-team doctor'],
    ['Conall Murtagh', 'fitnessCoach', 'Head of Physical Performance'],
    ['Jack Ade', 'fitnessCoach', 'First-team physical performance coach'],
    ['David Rydings', 'fitnessCoach', 'Rehabilitation Fitness Coach'],
    ['Chris Black', 'fitnessCoach', 'Lead strength and conditioning coach'],
  ]),
  ...staff('e364', 'https://www.liverpoolfc.com/teams/mens-team/matt-brown', 'Liverpool FC · Matt Brown', [
    ['Matt Brown', 'sportsScientist', 'Lead sports scientist'],
  ]),

  ...staff('e382', 'https://live.mancity.com/news/mens/coaching-team-enzo-maresca-confirmed-63919119/', 'Manchester City · Coaching team confirmed', [
    ['Roberto Vitiello', 'assistant', 'Assistant manager'],
    ['Willy Caballero', 'coach', 'First-team coach'],
    ['Danny Walker', 'coach', 'First-team coach'],
    ['Denis Silva', 'coach', 'First-team coach'],
    ['James French', 'coach', 'Set-piece coach'],
    ['Michele De Bernardin', 'goalkeepingCoach', 'Head of Goalkeeping'],
    ['Richard Wright', 'goalkeepingCoach', 'Goalkeeping coach'],
    ['Marcos Alvarez', 'fitnessCoach', 'Fitness coach'],
  ]),

  ...staff('e132', 'https://fcbayern.com/en/teams/first-team', 'FC Bayern · First-team staff', [
    ['Christoph Freund', 'sportingDirector', 'Sporting director'],
    ['Peter Ueblacker', 'headDoctor', 'Chief medical officer'],
    ['Jochen Hahne', 'doctor', 'Team doctor'],
    ['Roland Schmidt', 'doctor', 'Internist and cardiologist'],
    ['Benjamin Sommer', 'fitnessCoach', 'Fitness coach'],
    ['Simon Martinello', 'fitnessCoach', 'Fitness coach'],
    ['Markus Murrer', 'fitnessCoach', 'Fitness coach'],
    ['Quirin Löppert', 'fitnessCoach', 'Fitness coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/aaron-danks', 'FC Bayern · Aaron Danks', [
    ['Aaron Danks', 'assistant', 'Assistant coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/rene-mari%C4%87', 'FC Bayern · René Marić', [
    ['René Marić', 'assistant', 'Assistant coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/floribert-ngalula', 'FC Bayern · Floribert Ngalula', [
    ['Floribert Ngalula', 'assistant', 'Assistant coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/daniel-fradley', 'FC Bayern · Daniel Fradley', [
    ['Daniel Fradley', 'assistant', 'Assistant coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/michael-rechner', 'FC Bayern · Michael Rechner', [
    ['Michael Rechner', 'goalkeepingCoach', 'Goalkeeping coach'],
  ]),
  ...staff('e132', 'https://fcbayern.com/en/teams/first-team/coaches-and-staff/walter-gfrerer', 'FC Bayern · Walter Gfrerer', [
    ['Walter Gfrerer', 'fitnessCoach', 'Head of Performance'],
  ]),

  ...staff('e86', 'https://www.realmadrid.com/en-US/football/first-team/players', 'Real Madrid · First-team staff', [
    ['João Tralhão', 'assistant', 'Assistant coach'],
    ['Pedro Machado', 'coach', 'Technical assistant'],
    ['Sami Khedira', 'coach', 'Technical assistant'],
    ['Nuno Santos', 'goalkeepingCoach', 'Goalkeeper coach'],
    ['Antonio Dias', 'fitnessCoach', 'Fitness coach'],
    ['Antonio Pintus', 'fitnessCoach', 'Performance manager'],
    ['Sandro Carriço', 'sportsScientist', 'Sports Sciences'],
  ]),
]

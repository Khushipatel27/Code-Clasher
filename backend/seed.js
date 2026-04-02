require('dotenv').config();
const connectDB = require('./db/connect');
const Player = require('./db/models/Player');
const Match = require('./db/models/Match');

const players = [
  { playerName: 'codequeen', wins: 12, totalMatches: 15, avgScore: 91.2, avgTime: 42, winStreak: 4, lastPlayed: new Date() },
  { playerName: 'devgirl99', wins: 9, totalMatches: 13, avgScore: 85.5, avgTime: 55, winStreak: 2, lastPlayed: new Date() },
  { playerName: 'byterunner', wins: 7, totalMatches: 10, avgScore: 78.3, avgTime: 63, winStreak: 1, lastPlayed: new Date() },
  { playerName: 'loopmaster', wins: 6, totalMatches: 9, avgScore: 74.0, avgTime: 70, winStreak: 0, lastPlayed: new Date() },
  { playerName: 'syntaxwitch', wins: 5, totalMatches: 8, avgScore: 69.8, avgTime: 80, winStreak: 3, lastPlayed: new Date() },
];

const matches = [
  {
    matchId: 'LadyBug-abc',
    status: 'finished',
    language: 'python',
    difficulty: 'easy',
    question: {
      prompt: 'Write a function that returns the sum of two numbers.',
      topic: 'arithmetic',
      expectedOutput: '5',
      sampleSolution: 'def add(a, b): return a + b'
    },
    players: [
      { name: 'codequeen', socketId: 'fake-socket-1', submitted: true, code: 'def add(a,b): return a+b', score: 95, timeTaken: 38, feedback: 'Clean solution!' },
      { name: 'devgirl99', socketId: 'fake-socket-2', submitted: true, code: 'def add(a,b): return a+b+0', score: 70, timeTaken: 60, feedback: 'Correct but slightly verbose.' }
    ],
    winnerId: 'codequeen'
  }
];

async function seed() {
  await connectDB();
  await Player.deleteMany({});
  await Match.deleteMany({});
  await Player.insertMany(players);
  await Match.insertMany(matches);
  console.log('Seeded players and matches.');
  process.exit(0);
}

seed();

const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerName: { type: String, required: true, unique: true },
  wins: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
  avgScore: { type: Number, default: 0 },
  avgTime: { type: Number, default: 0 },
  winStreak: { type: Number, default: 0 },
  lastPlayed: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Player', playerSchema);

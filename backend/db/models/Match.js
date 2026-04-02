const mongoose = require('mongoose');

const playerEntrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  socketId: { type: String, required: true },
  submitted: { type: Boolean, default: false },
  code: { type: String, default: '' },
  score: { type: Number, default: 0 },
  timeTaken: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  readyForNextRound: { type: Boolean, default: false }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  prompt: String,
  topic: String,
  expectedOutput: String,
  sampleSolution: String
}, { _id: false });

const matchSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['waiting', 'countdown', 'active', 'finished'],
    default: 'waiting'
  },
  language: { type: String, required: true },
  difficulty: { type: String, required: true },
  question: questionSchema,
  players: [playerEntrySchema],
  winnerId: { type: String, default: null },
  round: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);

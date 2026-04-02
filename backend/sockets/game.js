const Match = require('../db/models/Match');
const Player = require('../db/models/Player');
const { generateQuestion, checkCode, generateMatchFeedback } = require('../services/gemini');

let waitingPlayer = null;
const BOT_NAME = 'SyntaxBot';
const BOT_SOCKET_ID = 'bot-socket-id';
// Set to true for demo mode (player vs bot), false for real 2-player mode
const BOT_MODE = true;

const botTimers = new Map(); // matchId -> timeoutId

function scheduleBotSubmission(socket, io, matchId, playerName, question, createdAt) {
  const botDelay = 25 * 1000;
  const timerId = setTimeout(async () => {
    botTimers.delete(matchId);
    const match = await Match.findOne({ matchId });
    if (!match || match.status !== 'active') return;

    const botEntry = match.players.find(p => p.name === BOT_NAME);
    if (!botEntry || botEntry.submitted) return;

    const botTimeTaken = Math.floor((Date.now() - createdAt) / 1000);
    botEntry.submitted = true;
    botEntry.code = question.sampleSolution;
    botEntry.score = 95;
    botEntry.timeTaken = botTimeTaken;
    botEntry.feedback = 'Flawless execution.';
    match.markModified('players');

    socket.emit('opponent_submitted', { playerName: BOT_NAME });

    const playerEntry = match.players.find(p => p.name === playerName);
    if (playerEntry && playerEntry.submitted) return;

    match.status = 'finished';
    match.winnerId = BOT_NAME;
    await match.save();

    socket.emit('match_over', {
      winner: BOT_NAME,
      round: match.round,
      scores: match.players.map(p => ({ name: p.name, score: p.score, timeTaken: p.timeTaken })),
      feedback: {
        winnerNote: 'SyntaxBot solved it perfectly.',
        loserNote: "You were close! Keep practicing your speed.",
        keyLesson: 'Speed and accuracy both matter in competitive coding.'
      },
      leaderboard: await Player.find().sort({ wins: -1, avgScore: -1 }).limit(10).lean()
    });

    await updateLeaderboard(BOT_NAME, true, 95, botTimeTaken);
    if (playerEntry) {
      await updateLeaderboard(playerName, false, playerEntry.score || 0, playerEntry.timeTaken || botTimeTaken);
    }
  }, botDelay);
  botTimers.set(matchId, timerId);
}

function generateMatchId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ARENA-';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function updateLeaderboard(playerName, won, score, timeTaken) {
  const player = await Player.findOne({ playerName });

  if (!player) {
    await Player.create({
      playerName,
      wins: won ? 1 : 0,
      totalMatches: 1,
      avgScore: score,
      avgTime: timeTaken,
      winStreak: won ? 1 : 0,
      lastPlayed: new Date()
    });
    return;
  }

  const newTotal = player.totalMatches + 1;
  const newAvgScore = ((player.avgScore * player.totalMatches) + score) / newTotal;
  const newAvgTime = ((player.avgTime * player.totalMatches) + timeTaken) / newTotal;
  const newWins = won ? player.wins + 1 : player.wins;
  const newStreak = won ? player.winStreak + 1 : 0;

  await Player.updateOne({ playerName }, {
    wins: newWins,
    totalMatches: newTotal,
    avgScore: parseFloat(newAvgScore.toFixed(1)),
    avgTime: parseFloat(newAvgTime.toFixed(1)),
    winStreak: newStreak,
    lastPlayed: new Date()
  });
}

function setupSockets(io) {
  io.on('connection', (socket) => {

    socket.on('find_match', async ({ playerName, language, difficulty }) => {
      if (BOT_MODE) {
        const matchId = generateMatchId();
        socket.join(matchId);

        socket.emit('match_found', { matchId, opponent: { p1: BOT_NAME, p2: playerName } });

        // Generate question and run countdown in parallel
        const questionPromise = generateQuestion(language, difficulty);

        const countdownPromise = new Promise((resolve) => {
          let count = 3;
          const tick = () => {
            socket.emit('countdown', { count });
            count--;
            if (count >= 0) setTimeout(tick, 1000);
            else resolve();
          };
          setTimeout(tick, 1000);
        });

        let question;
        try {
          [question] = await Promise.all([questionPromise, countdownPromise]);
        } catch (err) {
          socket.emit('match_error', { message: 'Failed to generate question. Try again.' });
          return;
        }

        try {
          await Match.create({
            matchId,
            status: 'active',
            language,
            difficulty,
            question,
            players: [
              { name: BOT_NAME, socketId: BOT_SOCKET_ID },
              { name: playerName, socketId: socket.id }
            ]
          });
        } catch (err) {
          socket.emit('match_error', { message: 'Failed to create match. Try again.' });
          return;
        }

        socket.emit('match_start', { prompt: question.prompt, topic: question.topic });
        scheduleBotSubmission(socket, io, matchId, playerName, question, Date.now());
        return;
      }

      if (!waitingPlayer) {
        waitingPlayer = { socketId: socket.id, playerName, language, difficulty };
        socket.emit('status', { message: 'Waiting for opponent...' });
        return;
      }

      if (waitingPlayer.language !== language || waitingPlayer.difficulty !== difficulty) {
        socket.emit('status', { message: 'Waiting for opponent...' });
        waitingPlayer = { socketId: socket.id, playerName, language, difficulty };
        return;
      }

      const opponent = waitingPlayer;
      waitingPlayer = null;

      const matchId = generateMatchId();

      let question;
      try {
        question = await generateQuestion(language, difficulty);
      } catch (err) {
        socket.emit('status', { message: 'Failed to generate question. Try again.' });
        return;
      }

      const match = await Match.create({
        matchId,
        status: 'countdown',
        language,
        difficulty,
        question,
        players: [
          { name: opponent.playerName, socketId: opponent.socketId },
          { name: playerName, socketId: socket.id }
        ]
      });

      socket.join(matchId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(matchId);

      io.to(matchId).emit('match_found', {
        matchId,
        opponent: { p1: opponent.playerName, p2: playerName }
      });

      let count = 3;
      const tick = () => {
        io.to(matchId).emit('countdown', { count });
        count--;
        if (count >= 0) {
          setTimeout(tick, 1000);
        } else {
          Match.updateOne({ matchId }, { status: 'active' }).exec();
          io.to(matchId).emit('match_start', {
            prompt: question.prompt,
            topic: question.topic
          });
        }
      };
      setTimeout(tick, 1000);
    });

    socket.on('submit_code', async ({ matchId, playerName, code }) => {
      const match = await Match.findOne({ matchId });
      if (!match || match.status !== 'active') return;

      const playerEntry = match.players.find(p => p.name === playerName);
      if (!playerEntry) return;

      const startTime = match.createdAt.getTime();
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      let judgment;
      try {
        judgment = await checkCode(code, match.question, match.language);
      } catch (err) {
        socket.emit('submission_result', {
          correct: false,
          partialScore: 0,
          feedback: 'Could not evaluate your code right now.',
          hint: 'Try again in a moment.'
        });
        return;
      }

      if (judgment.correct) {
        // Re-fetch to avoid race with bot timer
        const freshMatch = await Match.findOne({ matchId });
        if (!freshMatch || freshMatch.status !== 'active') return;

        // Cancel bot timer — player won first
        if (BOT_MODE && botTimers.has(matchId)) {
          clearTimeout(botTimers.get(matchId));
          botTimers.delete(matchId);
        }

        const freshPlayerEntry = freshMatch.players.find(p => p.name === playerName);
        if (!freshPlayerEntry) return;
        freshPlayerEntry.submitted = true;
        freshPlayerEntry.code = code;
        freshPlayerEntry.score = judgment.partialScore;
        freshPlayerEntry.timeTaken = timeTaken;
        freshPlayerEntry.feedback = judgment.feedback;
        freshMatch.markModified('players');

        freshMatch.status = 'finished';
        freshMatch.winnerId = playerName;
        await freshMatch.save();

        socket.emit('submission_result', {
          correct: true,
          partialScore: judgment.partialScore,
          feedback: judgment.feedback,
          hint: null
        });

        const opponentEntry = freshMatch.players.find(p => p.name !== playerName);

        let matchFeedback = { winnerNote: '', loserNote: '', keyLesson: '' };
        try {
          matchFeedback = await generateMatchFeedback(
            code,
            opponentEntry ? opponentEntry.code : '',
            freshMatch.question
          );
        } catch (_) {}

        const topPlayers = await Player.find().sort({ wins: -1, avgScore: -1 }).limit(10).lean();

        io.to(matchId).emit('match_over', {
          winner: playerName,
          round: freshMatch.round,
          scores: freshMatch.players.map(p => ({ name: p.name, score: p.score, timeTaken: p.timeTaken })),
          feedback: matchFeedback,
          leaderboard: topPlayers
        });

        await updateLeaderboard(playerName, true, judgment.partialScore, timeTaken);
        if (opponentEntry) {
          await updateLeaderboard(opponentEntry.name, false, opponentEntry.score, opponentEntry.timeTaken);
        }
      } else {
        // Wrong code — reset bot timer, keep same question, send hint
        if (BOT_MODE && botTimers.has(matchId)) {
          clearTimeout(botTimers.get(matchId));
          botTimers.delete(matchId);
        }

        // Re-fetch to check if bot already won during checkCode evaluation
        const retryMatch = await Match.findOne({ matchId });
        if (!retryMatch || retryMatch.status !== 'active') return;

        // Reset bot's submitted state using atomic update to avoid version conflicts
        await Match.updateOne(
          { matchId, status: 'active' },
          { $set: {
            'players.$[bot].submitted': false,
            'players.$[bot].code': '',
            'players.$[bot].score': 0,
            'players.$[bot].timeTaken': 0,
            'players.$[bot].feedback': ''
          }},
          { arrayFilters: [{ 'bot.name': BOT_NAME }] }
        );

        socket.emit('wrong_answer', {
          feedback: judgment.feedback,
          hint: judgment.hint,
          prompt: retryMatch.question.prompt,
          topic: retryMatch.question.topic
        });

        // Re-schedule bot for the retry attempt
        scheduleBotSubmission(socket, io, matchId, playerName, retryMatch.question, Date.now());
      }
    });

    socket.on('next_round', async ({ matchId, playerName }) => {
      const match = await Match.findOne({ matchId });
      if (!match || match.status !== 'finished') return;

      const playerEntry = match.players.find(p => p.name === playerName);
      if (!playerEntry) return;

      playerEntry.readyForNextRound = true;
      match.markModified('players');
      await match.save();

      // Notify others that this player is ready
      const opponentEntry = match.players.find(p => p.name !== playerName);
      if (opponentEntry && opponentEntry.socketId !== BOT_SOCKET_ID) {
        io.to(opponentEntry.socketId).emit('opponent_ready_next_round', { playerName });
      }

      const allReady = match.players.every(p => p.readyForNextRound || p.socketId === BOT_SOCKET_ID);
      if (!allReady) return;

      // Generate new question and reset state
      let question;
      try {
        question = await generateQuestion(match.language, match.difficulty);
      } catch (err) {
        socket.emit('status', { message: 'Failed to generate next question. Try again.' });
        return;
      }

      match.question = question;
      match.round += 1;
      match.status = 'countdown';
      match.winnerId = null;
      match.players.forEach(p => {
        p.submitted = false;
        p.code = '';
        p.score = 0;
        p.timeTaken = 0;
        p.feedback = '';
        p.readyForNextRound = false;
      });
      match.markModified('players');
      await match.save();

      io.to(matchId).emit('round_starting', { round: match.round });

      let count = 3;
      const tick = () => {
        io.to(matchId).emit('countdown', { count });
        count--;
        if (count >= 0) {
          setTimeout(tick, 1000);
        } else {
          Match.updateOne({ matchId }, { status: 'active' }).exec();
          io.to(matchId).emit('match_start', {
            prompt: question.prompt,
            topic: question.topic
          });

          if (BOT_MODE) {
            scheduleBotSubmission(socket, io, matchId, playerName, question, Date.now());
          }
        }
      };
      setTimeout(tick, 1000);
    });

    socket.on('player_disconnect', async ({ matchId, playerName }) => {
      await handleDisconnect(io, matchId, playerName);
    });

    socket.on('disconnect', async () => {
      if (waitingPlayer && waitingPlayer.socketId === socket.id) {
        waitingPlayer = null;
        return;
      }

      const match = await Match.findOne({
        status: { $in: ['waiting', 'countdown', 'active'] },
        'players.socketId': socket.id
      });

      if (!match) return;

      const disconnectedPlayer = match.players.find(p => p.socketId === socket.id);
      if (disconnectedPlayer) {
        await handleDisconnect(io, match.matchId, disconnectedPlayer.name);
      }
    });
  });
}

async function handleDisconnect(io, matchId, playerName) {
  const match = await Match.findOne({ matchId });
  if (!match || match.status === 'finished') return;

  const opponent = match.players.find(p => p.name !== playerName);
  match.status = 'finished';
  match.winnerId = opponent ? opponent.name : null;
  await match.save();

  if (opponent) {
    io.to(opponent.socketId).emit('match_over', {
      winner: opponent.name,
      scores: match.players.map(p => ({ name: p.name, score: p.score, timeTaken: p.timeTaken })),
      feedback: {
        winnerNote: 'Your opponent disconnected — you win!',
        loserNote: '',
        keyLesson: ''
      },
      leaderboard: []
    });

    await updateLeaderboard(opponent.name, true, opponent.score, opponent.timeTaken);
  }
}

module.exports = setupSockets;

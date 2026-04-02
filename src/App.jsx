import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { io } from 'socket.io-client';

const ROUND_TIME = 180;
const MAX_LIVES   = 3;

const BOT_TAUNTS = [
  'SyntaxBot is compiling…',
  'SyntaxBot is thinking…',
  'SyntaxBot has read the question…',
  'SyntaxBot is writing the solution…',
  'SyntaxBot is almost done…',
  'SyntaxBot double-checks the output…',
];

// ── Confetti ──────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const COLORS = ['#E2D37A', '#7bbf6a', '#ff9a9a', '#d5978a', '#4b8bbe', '#ffb347', '#c77dff'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${(i / 50) * 100}%`,
    delay: `${(i * 0.04).toFixed(2)}s`,
    duration: `${1.2 + (i % 5) * 0.2}s`,
    size: `${6 + (i % 5) * 2}px`,
    skew: `${(i % 3) * 15}deg`,
  }));
  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: p.left,
          backgroundColor: p.color,
          width: p.size,
          height: p.size,
          animationDelay: p.delay,
          animationDuration: p.duration,
          transform: `skew(${p.skew})`,
        }} />
      ))}
    </div>
  );
}

// ── Hearts ────────────────────────────────────────────────────
function Hearts({ lives }) {
  return (
    <div className="hearts-row">
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <span key={i} className={`heart ${i < lives ? 'heart-full' : 'heart-empty'}`}>
          {i < lives ? '❤️' : '🖤'}
        </span>
      ))}
    </div>
  );
}

// ── How to Play Modal ─────────────────────────────────────────
function HowToPlayModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">How to Play</h2>
        <ol className="htp-list">
          <li>Pick a <strong>difficulty</strong> and <strong>language</strong>, then enter your name.</li>
          <li>Hit <strong>PLAY</strong> — you'll race against <strong>SyntaxBot</strong>.</li>
          <li>A coding challenge appears. Write your solution in the editor.</li>
          <li>Press <strong>Submit</strong> or <kbd>Ctrl + Enter</kbd> to check your answer.</li>
          <li>Wrong answer? You lose a <strong>❤️ life</strong> and get a hint — try again!</li>
          <li>Lose all 3 lives and the round is forfeit.</li>
          <li>First to submit a correct answer <strong>wins the round</strong>.</li>
          <li>Win rounds to <strong>climb the leaderboard</strong>. 🐞</li>
        </ol>
        <p className="htp-tip">⌨️ <kbd>Tab</kbd> = indent &nbsp;·&nbsp; <kbd>Ctrl+Enter</kbd> = submit</p>
      </div>
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────
function Timer({ isActive, resetKey }) {
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const intervalRef = useRef(null);

  useEffect(() => { setTimeLeft(ROUND_TIME); }, [resetKey]);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => (t <= 1 ? (clearInterval(intervalRef.current), 0) : t - 1));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  const pct  = (timeLeft / ROUND_TIME) * 100;
  const urgent = timeLeft <= 30;

  return (
    <div className={`timer-container${urgent ? ' timer-urgent' : ''}`}>
      <span className="timer-label">⏱</span>
      <span className="timer-value">{mins}:{secs}</span>
      <div className="timer-bar-bg">
        <div className={`timer-bar-fill${urgent ? ' timer-bar-urgent' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
function App() {
  const [screen,       setScreen]       = useState('home');
  const [difficulty,   setDifficulty]   = useState(null);
  const [language,     setLanguage]     = useState(null);
  const [playerName,   setPlayerName]   = useState('');
  const [status,       setStatus]       = useState('');
  const [leaderboard,  setLeaderboard]  = useState([]);
  const [showHowToPlay,setShowHowToPlay]= useState(false);

  // Session
  const [sessionWins,   setSessionWins]   = useState(0);
  const [sessionLosses, setSessionLosses] = useState(0);
  const [roundNumber,   setRoundNumber]   = useState(1);
  const [timerResetKey, setTimerResetKey] = useState(0);

  // Battle
  const socketRef = useRef(null);
  const [matchId,      setMatchId]      = useState('');
  const [question,     setQuestion]     = useState('');
  const [userCode,     setUserCode]     = useState('');
  const [botCode,      setBotCode]      = useState('');
  const [gameStatus,   setGameStatus]   = useState('waiting');
  const [countdownNum, setCountdownNum] = useState(null);
  const [hint,         setHint]         = useState('');
  const [winner,       setWinner]       = useState('');
  const [matchFeedback,setMatchFeedback]= useState(null);
  const [attempts,     setAttempts]     = useState(0);
  const [lives,        setLives]        = useState(MAX_LIVES);
  const [outOfLives,   setOutOfLives]   = useState(false);
  const [connError,    setConnError]    = useState(false);
  const [copyDone,     setCopyDone]     = useState(false);
  const [botTaunt,     setBotTaunt]     = useState(BOT_TAUNTS[0]);
  const tauntRef = useRef(null);

  // Cycle bot taunt messages while active
  useEffect(() => {
    if (gameStatus === 'active') {
      let idx = 0;
      tauntRef.current = setInterval(() => {
        idx = (idx + 1) % BOT_TAUNTS.length;
        setBotTaunt(BOT_TAUNTS[idx]);
      }, 3500);
    } else {
      clearInterval(tauntRef.current);
    }
    return () => clearInterval(tauntRef.current);
  }, [gameStatus]);

  useEffect(() => {
    if (screen !== 'home') return;
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setLeaderboard(data))
      .catch(() => {});
  }, [screen]);

  function setupSocketListeners(socket, name) {
    socket.on('connect', () => {
      socket.emit('find_match', { playerName: name, language, difficulty });
    });
    socket.on('match_found', ({ matchId: id }) => setMatchId(id));
    socket.on('countdown', ({ count }) => setCountdownNum(count));
    socket.on('match_start', ({ prompt }) => {
      setQuestion(prompt);
      setGameStatus('active');
      setCountdownNum(null);
      setTimerResetKey(k => k + 1);
    });
    socket.on('opponent_submitted', () => {
      setBotCode('SyntaxBot has submitted…');
    });
    socket.on('submission_result', ({ correct, hint: h }) => {
      if (!correct) { setHint(h); setGameStatus('active'); }
    });
    socket.on('wrong_answer', ({ hint: h, prompt: p }) => {
      setHint(h);
      if (p) setQuestion(p);
      setAttempts(a => a + 1);
      setLives(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // Forfeit — disconnect and show out-of-lives screen
          socket.disconnect();
          setOutOfLives(true);
          setGameStatus('finished');
          setSessionLosses(l => l + 1);
        } else {
          setGameStatus('active');
        }
        return next;
      });
    });
    socket.on('round_starting', () => {
      setGameStatus('countdown');
      setUserCode(''); setBotCode(''); setHint('');
      setAttempts(0); setMatchFeedback(null); setQuestion('');
      setLives(MAX_LIVES); setOutOfLives(false);
      setRoundNumber(n => n + 1);
      setTimerResetKey(k => k + 1);
    });
    socket.on('match_over', ({ winner: w, feedback: f, scores }) => {
      setWinner(w);
      setMatchFeedback(f);
      setGameStatus('finished');
      if (w === name) setSessionWins(x => x + 1);
      else            setSessionLosses(x => x + 1);
      const botEntry = scores?.find(p => p.name !== name);
      if (botEntry?.code) setBotCode(botEntry.code);
    });
    socket.on('match_error',   ({ message }) => { setQuestion(message); setGameStatus('active'); });
    socket.on('connect_error', () => { setConnError(true); setGameStatus('error'); });
  }

  async function startBattle() {
    if (!difficulty || !language || !playerName.trim()) {
      setStatus('Pick a difficulty, language, and enter your name!');
      return;
    }
    fetch('/api/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: playerName.trim() })
    }).catch(() => {});

    setUserCode(''); setBotCode(''); setQuestion(''); setHint('');
    setWinner(''); setMatchFeedback(null); setAttempts(0);
    setRoundNumber(1); setSessionWins(0); setSessionLosses(0);
    setLives(MAX_LIVES); setOutOfLives(false); setConnError(false);
    setGameStatus('countdown'); setCountdownNum(null);
    setScreen('battle');

    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;
    setupSocketListeners(socket, playerName.trim());
  }

  const submitCode = useCallback(() => {
    if (!socketRef.current || !userCode.trim() || gameStatus !== 'active') return;
    setGameStatus('submitted');
    setHint('');
    socketRef.current.emit('submit_code', { matchId, playerName: playerName.trim(), code: userCode });
  }, [socketRef, userCode, gameStatus, matchId, playerName]);

  function reconnectAndRetry() {
    setUserCode(''); setBotCode(''); setHint('');
    setAttempts(0); setMatchFeedback(null); setWinner('');
    setLives(MAX_LIVES); setOutOfLives(false);
    setGameStatus('active');
    if (socketRef.current) socketRef.current.disconnect();
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;
    setupSocketListeners(socket, playerName.trim());
  }

  function goHome() {
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setScreen('home'); setGameStatus('waiting');
  }

  function handleEditorKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const newVal = userCode.substring(0, start) + '    ' + userCode.substring(el.selectionEnd);
      setUserCode(newVal);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 4; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submitCode(); }
  }

  function copyBotCode() {
    if (!botCode) return;
    navigator.clipboard.writeText(botCode).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  const medalFor   = (i) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
  const diffLabel  = { easy: 'Easy 🌱', medium: 'Medium 🔥', hard: 'Hard ☠️' };
  const langColor  = { Python: 'lang-py', JavaScript: 'lang-js', Java: 'lang-java' };
  const lineCount  = userCode.split('\n').length;

  // ── HOME ─────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home-root">
        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

        <header className="home-header">
          <div className="logo-block">
            <h1 className="title-main">CODE CLASH</h1>
            <h1 className="title-reflection">CODE CLASH</h1>
            <p className="title-tagline">Code fast. Clash harder. Win the round.</p>
          </div>
          <button className="htp-btn" onClick={() => setShowHowToPlay(true)}>? How to Play</button>
        </header>

        <main className="home-main">
          <section className="home-left">
            <div className="selector-card">
              <h2 className="selector-label">Difficulty</h2>
              <div className="selector-row">
                {['easy', 'medium', 'hard'].map(d => (
                  <button key={d}
                    className={`select-btn diff-${d}${difficulty === d ? ' selected' : ''}`}
                    onClick={() => setDifficulty(d)}>
                    {diffLabel[d]}
                  </button>
                ))}
              </div>
            </div>

            <div className="selector-card">
              <h2 className="selector-label">Language</h2>
              <div className="selector-row">
                {['Python', 'JavaScript', 'Java'].map(lang => (
                  <button key={lang}
                    className={`select-btn ${langColor[lang]}${language === lang ? ' selected' : ''}`}
                    onClick={() => setLanguage(lang)}>
                    {lang === 'JavaScript' ? 'JS' : lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="name-card">
              <input
                className="name-input"
                type="text"
                placeholder="Enter your name…"
                value={playerName}
                maxLength={20}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startBattle()}
              />
            </div>

            {status && <p className="status-text">{status}</p>}

            {/* Summary pill of selections */}
            {(difficulty || language) && (
              <div className="selection-summary">
                {difficulty && <span className={`pill diff-pill-${difficulty}`}>{diffLabel[difficulty]}</span>}
                {language   && <span className="pill lang-pill">{language}</span>}
              </div>
            )}

            <button className="play-btn" onClick={startBattle}>
              <svg className="ladybug-svg" viewBox="0 0 150 120" width="110" height="90">
                <ellipse cx="75" cy="70" rx="60" ry="45" fill="#C94021" />
                <circle cx="120" cy="70" r="25" fill="black" />
                <path d="M 130 50 Q 140 30 150 40" stroke="black" fill="none" strokeWidth="2" />
                <path d="M 135 55 Q 145 35 155 45" stroke="black" fill="none" strokeWidth="2" />
                <circle cx="80" cy="45" r="5" fill="black" />
                <circle cx="60" cy="85" r="5" fill="black" />
                <circle cx="90" cy="80" r="5" fill="black" />
              </svg>
              <span className="play-text">PLAY</span>
            </button>
          </section>

          <aside className="home-right">
            <div className="leaderboard-card">
              <h2 className="leaderboard-title">🏆 Leaderboard</h2>
              <div className="leaderboard-list">
                {leaderboard.length === 0 ? (
                  <p className="lb-empty">No players yet — be the first!</p>
                ) : (
                  leaderboard.map((player, i) => (
                    <div key={player._id} className={`lb-row${i < 3 ? ' lb-top' : ''}`}>
                      <span className="lb-rank">{medalFor(i)}</span>
                      <span className="lb-name">{player.playerName}</span>
                      <span className="lb-wins">{player.wins}W</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick-stats legend */}
            <div className="legend-card">
              <div className="legend-row"><span className="legend-dot dot-easy" />Easy — syntax basics</div>
              <div className="legend-row"><span className="legend-dot dot-medium" />Medium — functions & logic</div>
              <div className="legend-row"><span className="legend-dot dot-hard" />Hard — algorithms</div>
            </div>
          </aside>
        </main>
      </div>
    );
  }

  // ── BATTLE ───────────────────────────────────────────────────
  if (screen === 'battle') {
    const wonRound = gameStatus === 'finished' && winner === playerName.trim() && !outOfLives;

    // ── Backend not running ──────────────────────────────────────
    if (connError) {
      return (
        <div className="battle-root">
          <div className="battle-topbar">
            <span className="battle-title">CODE CLASH</span>
            <button className="back-btn-top" onClick={goHome}>← Menu</button>
          </div>
          <div className="conn-error-screen">
            <div className="conn-error-icon">⚠️</div>
            <h2 className="conn-error-title">Backend Not Running</h2>
            <p className="conn-error-body">
              The game server isn't reachable. Start the backend, then try again.
            </p>
            <div className="conn-error-steps">
              <p className="conn-step-label">Open a terminal and run:</p>
              <div className="conn-code-block">
                <code>cd backend</code>
                <code>npm run dev</code>
              </div>
              <p className="conn-step-label">Then make sure the frontend is running in a separate terminal:</p>
              <div className="conn-code-block">
                <code>npm start</code>
              </div>
              <p className="conn-step-note">Backend runs on port 5000 · Frontend on port 5173</p>
            </div>
            <div className="conn-error-actions">
              <button className="submit-btn" onClick={() => { setConnError(false); startBattle(); }}>
                Try Again
              </button>
              <button className="back-btn" onClick={goHome}>← Back to Menu</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="battle-root">
        {wonRound && <Confetti active />}

        {/* Top bar */}
        <div className="battle-topbar">
          <div className="battle-topbar-left">
            <span className="battle-title">CODE CLASH</span>
            <span className="round-badge">Round {roundNumber}</span>
          </div>
          <div className="session-score">
            <span className="score-win">{sessionWins}W</span>
            <span className="score-sep">/</span>
            <span className="score-loss">{sessionLosses}L</span>
          </div>
          {gameStatus !== 'finished' && (
            <button className="back-btn-top" onClick={goHome}>← Menu</button>
          )}
        </div>

        {/* Arena */}
        <div className="arena-row">
          {/* Player beetle */}
          <div className="beetle-card player-card">
            <svg width="80" height="80" viewBox="0 0 100 100">
              {/* Body */}
              <ellipse cx="50" cy="60" rx="28" ry="33" fill="#526022"/>
              {/* Wing split */}
              <line x1="50" y1="28" x2="50" y2="92" stroke="#3a4518" strokeWidth="1.5"/>
              {/* Head */}
              <circle cx="50" cy="24" r="13" fill="#3a4518"/>
              {/* Antennae */}
              <line x1="44" y1="13" x2="35" y2="3" stroke="#3a4518" strokeWidth="1.5"/>
              <line x1="56" y1="13" x2="65" y2="3" stroke="#3a4518" strokeWidth="1.5"/>
              <circle cx="35" cy="3" r="2.5" fill="#526022"/>
              <circle cx="65" cy="3" r="2.5" fill="#526022"/>
              {/* Spots */}
              <circle cx="38" cy="54" r="5" fill="#3a4518" opacity="0.5"/>
              <circle cx="62" cy="54" r="5" fill="#3a4518" opacity="0.5"/>
              <circle cx="40" cy="70" r="4" fill="#3a4518" opacity="0.5"/>
              <circle cx="60" cy="70" r="4" fill="#3a4518" opacity="0.5"/>
            </svg>
            <p className="beetle-label">{playerName || 'You'}</p>
            <Hearts lives={lives} />
          </div>

          {/* Center — countdown / VS / timer */}
          <div className="arena-center">
            {gameStatus === 'countdown' ? (
              <div className={`countdown-display${countdownNum === 0 ? ' countdown-go' : ''}`}>
                {countdownNum === null ? '⏳' : countdownNum === 0 ? 'GO!' : countdownNum}
              </div>
            ) : (
              <div className="vs-badge">VS</div>
            )}
            {gameStatus === 'active' && (
              <Timer isActive resetKey={timerResetKey} />
            )}
          </div>

          {/* Bot beetle */}
          <div className="beetle-card bot-card">
            <svg className={gameStatus === 'active' ? 'bot-pulse' : ''} width="80" height="80" viewBox="0 0 100 100">
              {/* Body */}
              <ellipse cx="50" cy="60" rx="28" ry="33" fill="#8B1A1A"/>
              {/* Wing split */}
              <line x1="50" y1="28" x2="50" y2="92" stroke="#5a0f0f" strokeWidth="1.5"/>
              {/* Head */}
              <circle cx="50" cy="24" r="13" fill="#5a0f0f"/>
              {/* Antennae */}
              <line x1="44" y1="13" x2="35" y2="3" stroke="#5a0f0f" strokeWidth="1.5"/>
              <line x1="56" y1="13" x2="65" y2="3" stroke="#5a0f0f" strokeWidth="1.5"/>
              <circle cx="35" cy="3" r="2.5" fill="#8B1A1A"/>
              <circle cx="65" cy="3" r="2.5" fill="#8B1A1A"/>
              {/* Spots */}
              <circle cx="38" cy="54" r="5" fill="black" opacity="0.35"/>
              <circle cx="62" cy="54" r="5" fill="black" opacity="0.35"/>
              <circle cx="40" cy="70" r="4" fill="black" opacity="0.35"/>
              <circle cx="60" cy="70" r="4" fill="black" opacity="0.35"/>
            </svg>
            <p className="beetle-label">SyntaxBot</p>
            {gameStatus === 'active' && (
              <p className="bot-taunt">{botTaunt}</p>
            )}
          </div>
        </div>

        {/* Question */}
        {question && gameStatus !== 'finished' && (
          <div className="question-card">
            <div className="question-header">
              <span className="question-tag">Challenge</span>
              <span className={`diff-tag diff-tag-${difficulty}`}>{difficulty?.toUpperCase()}</span>
              <span className="lang-tag">{language}</span>
            </div>
            <p className="question-text">{question}</p>
          </div>
        )}

        {/* Hint */}
        {hint && !outOfLives && (
          <div className="hint-card">
            <p className="hint-wrong">✗ Wrong — Attempt {attempts} &nbsp;·&nbsp; {lives} {lives === 1 ? 'life' : 'lives'} left</p>
            <p className="hint-body">💡 {hint}</p>
          </div>
        )}

        {/* Out of lives banner */}
        {outOfLives && (
          <div className="out-of-lives-card">
            <p className="out-of-lives-title">💀 Out of Lives!</p>
            <p>You used all {MAX_LIVES} attempts this round. Better luck next time!</p>
          </div>
        )}

        {/* Editors */}
        {(gameStatus === 'active' || gameStatus === 'submitted' || gameStatus === 'finished') && !outOfLives && (
          <div className="editors-row">
            <div className="editor-panel">
              <div className="editor-header">
                <span>📝 Your Code</span>
                <span className="lang-tag">{language}</span>
              </div>
              <textarea
                className="code-textarea"
                value={userCode}
                onChange={e => setUserCode(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder={`// Write your ${language} solution here…\n// Ctrl+Enter to submit | Tab to indent`}
                disabled={gameStatus !== 'active'}
                spellCheck={false}
              />
              <div className="editor-footer">
                <span className="line-count">{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
                {gameStatus === 'active' && (
                  <button className="submit-btn" onClick={submitCode} disabled={!userCode.trim()}>
                    Submit <kbd>Ctrl+↵</kbd>
                  </button>
                )}
                {gameStatus === 'submitted' && <p className="judging-text">⚙️ Judging…</p>}
              </div>
            </div>

            <div className="editor-panel">
              <div className="editor-header">
                <span>🤖 SyntaxBot's Code</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {gameStatus === 'finished' && <span className="revealed-tag">Revealed</span>}
                  {gameStatus === 'finished' && botCode && (
                    <button className="copy-btn" onClick={copyBotCode}>
                      {copyDone ? '✓ Copied' : '📋 Copy'}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className={`code-textarea${gameStatus !== 'finished' ? ' bot-blurred' : ''}`}
                value={botCode || (gameStatus === 'finished' ? 'No code available.' : 'Bot is coding…')}
                readOnly
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {gameStatus === 'finished' && (matchFeedback || outOfLives) && (
          <div className={`result-card${wonRound ? ' result-win' : ' result-loss'}`}>
            {wonRound ? (
              <>
                <h2 className="result-headline">🎉 You Win Round {roundNumber}!</h2>
                <p className="result-note">{matchFeedback?.winnerNote}</p>
                <p className="result-lesson">📚 {matchFeedback?.keyLesson}</p>
                <button className="submit-btn next-btn" onClick={() => {
                  socketRef.current?.emit('next_round', { matchId, playerName: playerName.trim() });
                  setUserCode(''); setBotCode(''); setHint('');
                  setAttempts(0); setMatchFeedback(null); setQuestion('');
                  setGameStatus('countdown');
                }}>Next Round →</button>
              </>
            ) : (
              <>
                <h2 className="result-headline result-headline-loss">
                  {outOfLives ? '💀 No Lives Left' : 'SyntaxBot Wins 🤖'}
                </h2>
                {matchFeedback && <p className="result-note">{matchFeedback.loserNote}</p>}
                {matchFeedback && <p className="result-lesson">📚 {matchFeedback.keyLesson}</p>}
                {question && (
                  <div className="retry-question">
                    <p className="question-label-small">The challenge was:</p>
                    <p className="question-text">{question}</p>
                  </div>
                )}
                <div className="result-actions">
                  <button className="submit-btn" onClick={reconnectAndRetry}>Try Again</button>
                  <button className="back-btn" onClick={goHome}>← Back to Menu</button>
                </div>
              </>
            )}
            <button className="back-btn" style={{ marginTop: 12 }} onClick={goHome}>← Back to Menu</button>
          </div>
        )}

        {gameStatus !== 'finished' && (
          <div className="battle-footer">
            <p className="footer-tip">Tab = indent &nbsp;·&nbsp; Ctrl+Enter = submit &nbsp;·&nbsp; {MAX_LIVES} lives per round</p>
          </div>
        )}
      </div>
    );
  }
}

export default App;

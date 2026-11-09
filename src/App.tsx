import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Легко',
  medium: 'Средне',
  hard: 'Сложно',
};

// Helper functions
const getRandomPosition = (snake: Position[]): Position => {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
};

const getInitialSnake = (): Position[] => [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

export default function App() {
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const gameStateRef = useRef<GameState>(gameState);
  const snakeRef = useRef<Position[]>(snake);
  const foodRef = useRef<Position>(food);
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync refs
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-high-score', score.toString());
    }
  }, [score, highScore]);

  // Draw game on canvas
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    // Draw food with glow effect
    const foodX = foodRef.current.x * cellSize;
    const foodY = foodRef.current.y * cellSize;
    const foodCenterX = foodX + cellSize / 2;
    const foodCenterY = foodY + cellSize / 2;

    // Glow
    const glowGradient = ctx.createRadialGradient(
      foodCenterX, foodCenterY, 0,
      foodCenterX, foodCenterY, cellSize * 1.5
    );
    glowGradient.addColorStop(0, 'rgba(255, 75, 75, 0.3)');
    glowGradient.addColorStop(1, 'rgba(255, 75, 75, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(foodX - cellSize, foodY - cellSize, cellSize * 3, cellSize * 3);

    // Food body
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, cellSize * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4b4b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, cellSize * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff7b7b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw snake
    const currentSnake = snakeRef.current;
    currentSnake.forEach((segment, index) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;

      if (index === 0) {
        // Head
        const headGradient = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        headGradient.addColorStop(0, '#4ade80');
        headGradient.addColorStop(1, '#22c55e');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 6);
        ctx.fill();

        // Eyes
        const eyeSize = cellSize * 0.12;
        ctx.fillStyle = '#fff';
        let eye1X = x + cellSize * 0.3;
        let eye1Y = y + cellSize * 0.3;
        let eye2X = x + cellSize * 0.7;
        let eye2Y = y + cellSize * 0.3;

        if (directionRef.current === 'DOWN') {
          eye1Y = y + cellSize * 0.7;
          eye2Y = y + cellSize * 0.7;
        } else if (directionRef.current === 'LEFT') {
          eye1X = x + cellSize * 0.3;
          eye1Y = y + cellSize * 0.3;
          eye2X = x + cellSize * 0.3;
          eye2Y = y + cellSize * 0.7;
        } else if (directionRef.current === 'RIGHT') {
          eye1X = x + cellSize * 0.7;
          eye1Y = y + cellSize * 0.3;
          eye2X = x + cellSize * 0.7;
          eye2Y = y + cellSize * 0.7;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Body segments with gradient
        const alpha = 1 - (index / currentSnake.length) * 0.4;
        const green = Math.floor(180 + (index / currentSnake.length) * 40);
        ctx.fillStyle = `rgba(34, ${green}, 80, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x + padding + 1, y + padding + 1, cellSize - (padding + 1) * 2, cellSize - (padding + 1) * 2, 4);
        ctx.fill();
      }
    });
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      drawGame();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [drawGame]);

  // Game loop
  const gameStep = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;

    const currentSnake = [...snakeRef.current];
    const head = { ...currentSnake[0] };
    const dir = directionRef.current;

    switch (dir) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }

    // Check wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setGameState('gameover');
      return;
    }

    // Check self collision
    if (currentSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
      setGameState('gameover');
      return;
    }

    const newSnake = [head, ...currentSnake];
    const currentFood = foodRef.current;

    if (head.x === currentFood.x && head.y === currentFood.y) {
      // Ate food
      setScore(prev => prev + 10);
      setFood(getRandomPosition(newSnake));
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  }, []);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(gameStep, SPEEDS[difficulty]);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, difficulty, gameStep]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === ' ') {
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        } else if (gameState === 'idle') {
          startGame();
        } else if (gameState === 'gameover') {
          resetGame();
        }
        return;
      }

      if (gameState !== 'playing') return;

      const dir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dir !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dir !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dir !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dir !== 'LEFT') setDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
        // Tap - toggle pause or start
        if (gameStateRef.current === 'idle') {
          startGame();
        } else if (gameStateRef.current === 'gameover') {
          resetGame();
        } else if (gameStateRef.current === 'playing') {
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          setGameState('playing');
        }
        touchStartRef.current = null;
        return;
      }

      if (gameStateRef.current !== 'playing') {
        touchStartRef.current = null;
        return;
      }

      const dir = directionRef.current;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && dir !== 'LEFT') setDirection('RIGHT');
        else if (dx < 0 && dir !== 'RIGHT') setDirection('LEFT');
      } else {
        if (dy > 0 && dir !== 'UP') setDirection('DOWN');
        else if (dy < 0 && dir !== 'DOWN') setDirection('UP');
      }

      touchStartRef.current = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Resize canvas
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      if (!container) return;
      const size = Math.min(container.clientWidth, container.clientHeight, 500);
      canvas.width = size;
      canvas.height = size;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const startGame = () => {
    setSnake(getInitialSnake());
    setFood(getRandomPosition(getInitialSnake()));
    setDirection('RIGHT');
    setScore(0);
    setGameState('playing');
  };

  const resetGame = () => {
    setSnake(getInitialSnake());
    setFood(getRandomPosition(getInitialSnake()));
    setDirection('RIGHT');
    setScore(0);
    setGameState('idle');
  };

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  const selectDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setShowDifficultyModal(false);
    resetGame();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#1a1a3e] to-[#24243e] flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
          🐍 Змейка
        </h1>

        {/* Score Board */}
        <div className="flex justify-between items-center bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Счёт</div>
            <div className="text-2xl font-bold text-green-400 tabular-nums">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Рекорд</div>
            <div className="text-2xl font-bold text-yellow-400 tabular-nums">{highScore}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Сложность</div>
            <button
              onClick={() => setShowDifficultyModal(true)}
              className="text-lg font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              {DIFFICULTY_LABELS[difficulty]}
            </button>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative w-full max-w-lg aspect-square">
        <div className="absolute inset-0 bg-[#1a1a2e] rounded-2xl border-2 border-white/10 shadow-2xl shadow-green-500/10 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-2xl"
          />

          {/* Overlays */}
          {gameState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl animate-fade-in">
              <div className="text-6xl mb-4 animate-bounce">🐍</div>
              <p className="text-white text-lg mb-2">Нажмите чтобы начать</p>
              <p className="text-gray-400 text-sm">или пробел / свайп</p>
              <button
                onClick={startGame}
                className="mt-6 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                Играть
              </button>
            </div>
          )}

          {gameState === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl animate-fade-in">
              <div className="text-5xl mb-4">⏸️</div>
              <p className="text-white text-xl font-bold mb-2">Пауза</p>
              <button
                onClick={togglePause}
                className="mt-4 px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-full shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                Продолжить
              </button>
            </div>
          )}

          {gameState === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl animate-fade-in">
              <div className="text-5xl mb-4">💀</div>
              <p className="text-red-400 text-2xl font-bold mb-2">Игра окончена!</p>
              <p className="text-white text-lg mb-1">Счёт: <span className="text-green-400 font-bold">{score}</span></p>
              {score >= highScore && score > 0 && (
                <p className="text-yellow-400 text-sm mb-2 animate-pulse">🏆 Новый рекорд!</p>
              )}
              <button
                onClick={startGame}
                className="mt-4 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full shadow-lg shadow-green-500/30 hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                Играть снова
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 flex justify-between items-center gap-3">
        <button
          onClick={togglePause}
          disabled={gameState !== 'playing' && gameState !== 'paused'}
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
        >
          {gameState === 'paused' ? '▶ Продолжить' : '⏸ Пауза'}
        </button>
        <button
          onClick={resetGame}
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/10 transition-all duration-200 cursor-pointer"
        >
          🔄 Заново
        </button>
      </div>

      {/* Mobile D-Pad */}
      <div className="mt-4 md:hidden">
        <div className="grid grid-cols-3 gap-2 w-40 mx-auto">
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameState === 'playing' && direction !== 'DOWN') setDirection('UP'); }}
            className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors mx-auto"
          >
            ↑
          </button>
          <div />
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameState === 'playing' && direction !== 'RIGHT') setDirection('LEFT'); }}
            className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors mx-auto"
          >
            ←
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameState === 'playing' && direction !== 'UP') setDirection('DOWN'); }}
            className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors mx-auto"
          >
            ↓
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); if (gameState === 'playing' && direction !== 'LEFT') setDirection('RIGHT'); }}
            className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors mx-auto"
          >
            →
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-gray-500 text-xs max-w-lg">
        <p className="hidden md:block">
          <span className="text-gray-400">Управление:</span> Стрелки / WASD — движение • Пробел — пауза
        </p>
        <p className="md:hidden">
          <span className="text-gray-400">Управление:</span> Свайп или кнопки • Тап — пауза
        </p>
      </div>

      {/* Difficulty Modal */}
      {showDifficultyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-[#1e1e3a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-white text-center mb-4">Выберите сложность</h2>
            <div className="space-y-3">
              {(Object.keys(SPEEDS) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => selectDifficulty(d)}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
                    difficulty === d
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{DIFFICULTY_LABELS[d]}</span>
                    <span className="text-sm opacity-70">
                      {d === 'easy' ? '🐢' : d === 'medium' ? '🐇' : '⚡'} {SPEEDS[d]}мс
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDifficultyModal(false)}
              className="w-full mt-4 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 1. OBSERVER PATTERN (Event Dispatcher Engine)
// ============================================================================
class EventNotifier {
    constructor() {
        this.events = {};
    }
    subscribe(eventName, callback) {
        if (!this.events[eventName]) this.events[eventName] = [];
        this.events[eventName].push(callback);
    }
    notify(eventName, eventData) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(eventData));
        }
    }
}

// ============================================================================
// 2. THE MODEL (Singleton Game State Manager)
// ============================================================================
class GameState extends EventNotifier {
    constructor() {
        if (GameState.instance) return GameState.instance;
        super();
        this.resetState();
        GameState.instance = this;
    }

    resetState() {
        // Matrix-based board configuration (3x3 array)
        this.board = [
            ['', '', ''],
            ['', '', ''],
            ['', '', '']
        ];
        this.currentTurn = 'X';
        this.isGameOver = false;
        this.totalMoves = 0;
    }

    makeMove(index) {
        const row = Math.floor(index / 3);
        const col = index % 3;

        // Prevent modifying occupied blocks or handling interactions post-match
        if (this.board[row][col] !== '' || this.isGameOver) return false;

        this.board[row][col] = this.currentTurn;
        this.totalMoves++;

        // Instantaneous verification check using matrix algorithms
        if (this.checkWinConditions(row, col)) {
            this.isGameOver = true;
            this.notify('gameEnded', { winner: this.currentTurn });
            return true;
        }

        if (this.totalMoves === 9) {
            this.isGameOver = true;
            this.notify('gameEnded', { winner: 'Draw' });
            return true;
        }

        // Switch turns seamlessly
        this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
        this.notify('turnChanged', { nextTurn: this.currentTurn });
        return true;
    }

    checkWinConditions(row, col) {
        const symbol = this.board[row][col];

        // Matrix evaluation paths
        if (this.board[row].every(cell => cell === symbol)) return true; // Horizontal Row
        if (this.board.every(r => r[col] === symbol)) return true;      // Vertical Column
        if (row === col && this.board.every((r, i) => r[i] === symbol)) return true; // Diagonal
        if (row + col === 2 && this.board.every((r, i) => r[2 - i] === symbol)) return true; // Anti-Diagonal

        return false;
    }
}

// ============================================================================
// 3. THE BUILDER PATTERN (Dynamic Node Compilation)
// ============================================================================
class LeaderboardRowBuilder {
    constructor() { this.clear(); }
    clear() { this.element = document.createElement('div'); this.element.className = 'leaderboard-row'; }
    setPlayerIdentity(playerTag) {
        const wrapper = document.createElement('span');
        wrapper.textContent = playerTag;
        wrapper.style.fontWeight = 'bold';
        this.element.appendChild(wrapper);
        return this;
    }
    setScoreMetrics(scoreValue) {
        const wrapper = document.createElement('span');
        wrapper.textContent = `${scoreValue} Match Wins`;
        this.element.appendChild(wrapper);
        return this;
    }
    build() {
        const finishedNode = this.element;
        this.clear();
        return finishedNode;
    }
}

// ============================================================================
// 4. THE LEADERBOARD VIEW & LOCAL STORAGE ENGINE
// ============================================================================
class LeaderboardView {
    constructor() {
        this.listContainer = document.getElementById('leaderboard-list');
        this.uiBuilder = new LeaderboardRowBuilder();
        this.recordStore = JSON.parse(localStorage.getItem('pro_ttt_scores')) || { X: 0, O: 0 };
        this.render();
    }

    updateScore(gameResult) {
        if (gameResult.winner && gameResult.winner !== 'Draw') {
            this.recordStore[gameResult.winner]++;
            localStorage.setItem('pro_ttt_scores', JSON.stringify(this.recordStore));
            this.render();
        }
    }

    // NEW METHOD: Wipes the storage state completely and updates UI
    resetMetrics() {
        this.recordStore = { X: 0, O: 0 };
        localStorage.removeItem('pro_ttt_scores'); // Completely remove from Web Storage API
        this.render();
    }

    render() {
        this.listContainer.innerHTML = '';
        Object.entries(this.recordStore).forEach(([player, score]) => {
            const rawElement = this.uiBuilder
                .setPlayerIdentity(`Player ${player}`)
                .setScoreMetrics(score)
                .build();
            this.listContainer.appendChild(rawElement);
        });
    }
}

// ============================================================================
// 5. THE CONTROLLER (The Event Handler and Mediator)
// ============================================================================
class GameController {
    constructor(model, leaderboard) {
        this.model = model;
        this.leaderboard = leaderboard;

        // Element Links
        this.gridBoard = document.getElementById('game-board');
        this.statusBox = document.getElementById('status-display');
        this.resetTrigger = document.getElementById('reset-btn');

        // Modal Overlay Elements
        this.screenOverlay = document.getElementById('game-overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMessage = document.getElementById('overlay-message');
        this.overlayCloseTrigger = document.getElementById('overlay-close-btn');
        // NEW DOM Element Reference
        this.clearLeaderboardTrigger = document.getElementById('clear-leaderboard-btn');
        this.wireEvents();
    }

    wireEvents() {
        // High-Performance Event Delegation: Listening to parent grid component
        this.gridBoard.addEventListener('click', (event) => {
            if (event.target.classList.contains('cell')) {
                const matrixIndex = parseInt(event.target.getAttribute('data-index'));
                if (this.model.makeMove(matrixIndex)) {
                    this.synchronizeBoardUI();
                }
            }
        });

        // Unified Clear Action
        const resetAction = () => {
            this.model.resetState();
            this.synchronizeBoardUI();
            this.screenOverlay.classList.remove('active');
            this.statusBox.textContent = "Player X's Turn";
        };

        this.resetTrigger.addEventListener('click', resetAction);
        this.overlayCloseTrigger.addEventListener('click', resetAction);

        // Managing Subscriptions via Observer Pipeline
        this.model.subscribe('turnChanged', (data) => {
            this.statusBox.textContent = `Player ${data.nextTurn}'s Turn`;
        });

        this.model.subscribe('gameEnded', (data) => {
            this.handleMatchClosureEvent(data.winner);
        });

        // NEW EVENT HANDLER: Listens for leaderboard wipe request
        this.clearLeaderboardTrigger.addEventListener('click', () => {
            if (confirm("Are you sure you want to completely wipe out the local leaderboard stats?")) {
                this.leaderboard.resetMetrics();
            }
        });
    }


    synchronizeBoardUI() {
        const linearMatrix = this.model.board.flat();
        const structuralCells = this.gridBoard.querySelectorAll('.cell');

        structuralCells.forEach((cell, idx) => {
            const markToken = linearMatrix[idx];
            cell.textContent = markToken;
            
            // Clean dynamic class modifications
            cell.className = 'cell';
            if (markToken === 'X') cell.classList.add('x-marker');
            if (markToken === 'O') cell.classList.add('o-marker');
        });
    }

    handleMatchClosureEvent(winner) {
        if (winner === 'Draw') {
            this.statusBox.textContent = "Match drawn!";
            this.overlayTitle.textContent = "It's a Draw!";
            this.overlayTitle.className = "overlay-title overlay-draw";
            this.overlayMessage.textContent = "Balanced strategies applied. Neither player yielded structural control.";
        } else {
            this.statusBox.textContent = `Player ${winner} dominated!`;
            this.overlayTitle.textContent = `Player ${winner} Wins!`;
            this.overlayTitle.className = "overlay-title overlay-win";
            this.overlayMessage.textContent = `Match concluded. Player ${winner} broke through structural defenses successfully.`;

            // Sync with local record engine
            this.leaderboard.updateScore({ winner });
        }

        // Trigger visual presence change on viewport overlay
        this.screenOverlay.classList.add('active');
    }
}

// Dynamic Module Mounting Initialization
document.addEventListener('DOMContentLoaded', () => {
    const dataModel = new GameState(); // Singleton Pattern Instance
    const UILeaderboard = new LeaderboardView();
    new GameController(dataModel, UILeaderboard);
});
#!/bin/bash
# DeWare — Start everything in one tmux session
# Usage: ./start.sh
#
# Windows:
#   0 = orchestrator
#   1 = scout-1     (R1, INTAKE)
#   2 = lifter-2    (R2, STORAGE)
#   3 = scout-3     (R3, STAGING)
#   4 = carrier-4   (R4, DISPATCH)
#   5 = lifter-5    (R5, INTAKE)
#   6 = frontend

SESSION="swarmtrust"
BACKEND="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND="$(cd "$(dirname "$0")/frontend" && pwd)"

# Kill existing session if running
tmux kill-session -t $SESSION 2>/dev/null

# Create session with window 0 = orchestrator
tmux new-session -d -s $SESSION -n "orchestrator" -x 220 -y 50
tmux send-keys -t $SESSION:0 "cd $BACKEND && npm run orchestrator" Enter

# Window 1–5 = robots
tmux new-window -t $SESSION:1 -n "scout-1"
tmux send-keys -t $SESSION:1 "cd $BACKEND && sleep 3 && npm run robot:1" Enter

tmux new-window -t $SESSION:2 -n "lifter-2"
tmux send-keys -t $SESSION:2 "cd $BACKEND && sleep 3 && npm run robot:2" Enter

tmux new-window -t $SESSION:3 -n "scout-3"
tmux send-keys -t $SESSION:3 "cd $BACKEND && sleep 3 && npm run robot:3" Enter

tmux new-window -t $SESSION:4 -n "carrier-4"
tmux send-keys -t $SESSION:4 "cd $BACKEND && sleep 3 && npm run robot:4" Enter

tmux new-window -t $SESSION:5 -n "lifter-5"
tmux send-keys -t $SESSION:5 "cd $BACKEND && sleep 3 && npm run robot:5" Enter

# Window 6 = frontend
tmux new-window -t $SESSION:6 -n "frontend"
tmux send-keys -t $SESSION:6 "cd $FRONTEND && npm run dev" Enter

# Focus orchestrator window on attach
tmux select-window -t $SESSION:0

echo ""
echo "  DeWare started in tmux session: $SESSION"
echo ""
echo "  tmux attach -t $SESSION        # open logs"
echo "  Ctrl+B, then 0-6               # switch windows"
echo "  Ctrl+B, then D                 # detach (keep running)"
echo "  tmux kill-session -t $SESSION  # stop everything"
echo ""
echo "  Frontend → http://localhost:3006"
echo "  Orchestrator WS → ws://localhost:8080"
echo ""

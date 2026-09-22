#!/usr/bin/env bash
# Dress rehearsal of a full weekend on a local fork of Robinhood Chain testnet, using the real agent.
#
#   scripts/rehearse-weekend.sh [GAP_PER_MILLE]
#
# GAP_PER_MILLE is the reopening move in tenths of a percent (default -35 = -3.5%, into the crash range, so the
# pool's cover pays out). Stages Friday (a 10 USDG loan and the last pre-close price), jumps to Saturday and runs
# one agent cycle (open market, point oracle, pool hedge, trade), then jumps to the Sunday 20:00 ET reopen, posts
# the reopening price and runs another (settle, collect cover, withdraw residual, claim fees). Nothing touches the
# real testnet: every transaction goes to the fork, which is discarded at the end.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

GAP=${1:--35}
PORT=8547
FORK=http://localhost:$PORT
DEPLOY=contracts/deployments/46630.json
addr() { python3 -c "import json;print(json.load(open('$DEPLOY'))['$1'])"; }
CAL=$(addr calendar); FEED=$(addr feed); POOL=$(addr lendingPool); STOCK=$(addr stock); USDG=$(addr usdg)

anvil --fork-url https://rpc.testnet.chain.robinhood.com --chain-id 46630 --port $PORT --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
sleep 3

send() { cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url $FORK >/dev/null; }
now=$(cast block latest --rpc-url $FORK -f timestamp)
# Next Friday close: the first closed hour ahead, then its session boundary.
t=$now
until [ "$(cast call $CAL 'isOpen(uint256)(bool)' $t --rpc-url $FORK)" = "false" ]; do t=$((t + 3600)); done
CLOSE=$(cast call $CAL 'lastClose(uint256)(uint256)' $t --rpc-url $FORK | awk '{print $1}')
REOPEN=$(cast call $CAL 'nextOpen(uint256)(uint256)' $t --rpc-url $FORK | awk '{print $1}')
echo "closure: $(date -u -r "$CLOSE") -> $(date -u -r "$REOPEN")"

echo "== Friday: open a 10 USDG loan, post the last pre-close price"
send $STOCK 'approve(address,uint256)' $POOL 1000000000000000000
send $POOL 'deposit(uint256)' 1000000000000000000
send $POOL 'borrow(uint256)' 10000000
REF=$(cast call $FEED 'latestRoundData()(uint80,int256,uint256,uint256,uint80)' --rpc-url $FORK | sed -n 2p | awk '{print $1}')
cast rpc evm_setNextBlockTimestamp $((CLOSE - 60)) --rpc-url $FORK >/dev/null
send $FEED 'mirror(int256,uint256,uint256)' "$REF" $((CLOSE - 60)) $((CLOSE - 60))

echo "== Saturday: one agent cycle"
cast rpc evm_setNextBlockTimestamp $((CLOSE + 12 * 3600)) --rpc-url $FORK >/dev/null
cast rpc evm_mine --rpc-url $FORK >/dev/null
(cd apps/agent && TESTNET_RPC_URL=$FORK npm run once --silent 2>&1 | grep -E '\[(keeper|trader)\]' || true)

echo "== Sunday 20:00 ET: reopen ${GAP} per mille, one agent cycle"
cast rpc evm_setNextBlockTimestamp $((REOPEN + 5)) --rpc-url $FORK >/dev/null
send $FEED 'mirror(int256,uint256,uint256)' $((REF * (1000 + GAP) / 1000)) $((REOPEN + 5)) $((REOPEN + 5))
cast rpc evm_setNextBlockTimestamp $((REOPEN + 60)) --rpc-url $FORK >/dev/null
cast rpc evm_mine --rpc-url $FORK >/dev/null
before=$(cast call $USDG 'balanceOf(address)(uint256)' $POOL --rpc-url $FORK | awk '{print $1}')
(cd apps/agent && TESTNET_RPC_URL=$FORK npm run once --silent 2>&1 | grep -E '\[(keeper|trader)\]' || true)
after=$(cast call $USDG 'balanceOf(address)(uint256)' $POOL --rpc-url $FORK | awk '{print $1}')
echo "pool USDG reserves: $before -> $after"

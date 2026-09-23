#!/usr/bin/env bash
# Dress rehearsal of a full weekend on a local fork of Robinhood Chain testnet, using the real agent.
#
#   scripts/rehearse-weekend.sh [TSLA_GAP_PER_MILLE] [AMZN_GAP_PER_MILLE]
#
# Gaps are reopening moves in tenths of a percent (defaults -35 = -3.5% for TSLA, into the crash range so its pool's
# cover pays out, and +8 = +0.8% for AMZN). For every stock it stages Friday (a 5 USDG loan and the last pre-close
# price, taken from the stock's mainnet Chainlink feed), jumps to Saturday and runs one agent cycle (open both
# markets, point oracles, pool hedges, trade), then jumps to the Sunday 20:00 ET reopen, posts the reopening prices
# and runs another (settle, collect cover, withdraw residual, claim fees).
# Anvil cannot execute Stylus WASM, so the Solidity reference LmsrMathSol (bit-identical, checked on-chain by
# stylus/lmsr-math/scripts/parity_check.py) is etched over the Stylus address first.
# Nothing touches the real testnet: every transaction goes to the fork, which is discarded at the end.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

GAP_TSLA=${1:--35}; GAP_AMZN=${2:-8}
# macOS ships bash 3.2 (no associative arrays): per-stock values live in VAR_<SYMBOL>, read with ${!name}.
at() { local name="$1_$2"; echo "${!name}"; }
PORT=8547
FORK=http://localhost:$PORT
MAINNET=https://rpc.mainnet.chain.robinhood.com
DEPLOY=contracts/deployments/46630.json
get() { python3 -c "import json;d=json.load(open('$DEPLOY'))
for k in '$1'.split('.'): d=d[k]
print(d)"; }
CAL=$(get calendar); USDG=$(get usdg); MATH=$(get lmsrMath)
SYMBOLS=$(python3 -c "import json;print(' '.join(json.load(open('$DEPLOY'))['stocks']))")

anvil --fork-url https://rpc.testnet.chain.robinhood.com --chain-id 46630 --port $PORT --silent &
ANVIL=$!
trap 'kill $ANVIL 2>/dev/null' EXIT
sleep 3

send() { cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url $FORK >/dev/null; }
cast rpc anvil_setCode "$MATH" "$(cd contracts && forge inspect LmsrMathSol deployedBytecode)" --rpc-url $FORK >/dev/null

now=$(cast block latest --rpc-url $FORK -f timestamp)
# Next Friday close: the first closed hour ahead, then its session boundary.
t=$now
until [ "$(cast call $CAL 'isOpen(uint256)(bool)' $t --rpc-url $FORK)" = "false" ]; do t=$((t + 3600)); done
CLOSE=$(cast call $CAL 'lastClose(uint256)(uint256)' $t --rpc-url $FORK | awk '{print $1}')
REOPEN=$(cast call $CAL 'nextOpen(uint256)(uint256)' $t --rpc-url $FORK | awk '{print $1}')
echo "closure: $(date -u -r "$CLOSE") -> $(date -u -r "$REOPEN")"

echo "== Friday: post the last pre-close price, fund each pool with 10 USDG, open a 5 USDG loan"
LAST=$((CLOSE - 600))
cast rpc evm_setNextBlockTimestamp $LAST --rpc-url $FORK >/dev/null
for S in $SYMBOLS; do
  POOL=$(get stocks.$S.lendingPool); TOKEN=$(get stocks.$S.token)
  printf -v "REF_$S" '%s' "$(cast call $(get stocks.$S.mainnetFeed) 'latestRoundData()(uint80,int256,uint256,uint256,uint80)' --rpc-url $MAINNET | sed -n 2p | awk '{print $1}')"
  send $(get stocks.$S.feed) 'mirror(int256,uint256,uint256)' "$(at REF $S)" $LAST $LAST
  send $USDG 'transfer(address,uint256)' $POOL 10000000
  send $TOKEN 'approve(address,uint256)' $POOL 1000000000000000000
  send $POOL 'deposit(uint256)' 1000000000000000000
  send $POOL 'borrow(uint256)' 5000000
  echo "   $S Friday close $(at REF $S) (8 decimals)"
done

echo "== Saturday: one agent cycle"
cast rpc evm_setNextBlockTimestamp $((CLOSE + 12 * 3600)) --rpc-url $FORK >/dev/null
cast rpc evm_mine --rpc-url $FORK >/dev/null
(cd apps/agent && TESTNET_RPC_URL=$FORK npm run once --silent 2>&1 | grep -E '\[(keeper|trader)\]' || true)

echo "== Sunday 20:00 ET: reopen, one agent cycle"
cast rpc evm_setNextBlockTimestamp $((REOPEN + 5)) --rpc-url $FORK >/dev/null
for S in $SYMBOLS; do
  echo "   $S reopens $(at GAP $S) per mille"
  send $(get stocks.$S.feed) 'mirror(int256,uint256,uint256)' $(($(at REF $S) * (1000 + $(at GAP $S)) / 1000)) $((REOPEN + 5)) $((REOPEN + 5))
done
cast rpc evm_setNextBlockTimestamp $((REOPEN + 60)) --rpc-url $FORK >/dev/null
cast rpc evm_mine --rpc-url $FORK >/dev/null
for S in $SYMBOLS; do printf -v "BEFORE_$S" '%s' "$(cast call $USDG 'balanceOf(address)(uint256)' $(get stocks.$S.lendingPool) --rpc-url $FORK | awk '{print $1}')"; done
(cd apps/agent && TESTNET_RPC_URL=$FORK npm run once --silent 2>&1 | grep -E '\[(keeper|trader)\]' || true)
for S in $SYMBOLS; do
  echo "$S pool USDG reserves: $(at BEFORE $S) -> $(cast call $USDG 'balanceOf(address)(uint256)' $(get stocks.$S.lendingPool) --rpc-url $FORK | awk '{print $1}')"
done

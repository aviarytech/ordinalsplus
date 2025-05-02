// npm install micro-ordinals @scure/btc-signer @scure/base
import * as btc from '@scure/btc-signer';
import * as ordinals from 'micro-ordinals';
import { hex, utf8 } from '@scure/base';

const TESTNET = btc.utils.TEST_NETWORK;
const privKey = hex.decode('0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a');
const pubKey = btc.utils.pubSchnorr(privKey);
const customScripts = [ordinals.OutOrdinalReveal]; // Enable custom scripts outside

// This inscribes on first satoshi of first input (default)
const inscription = {
  tags: {
    contentType: 'application/json', // can be any format (MIME type)
    // ContentEncoding: 'br', // compression: only brotli supported
  },
  body: utf8.decode(JSON.stringify({ some: 1, test: 2, inscription: true, in: 'json' })),
  // One can use previously inscribed js scripts in html
  // utf8.decode(`<html><head></head><body><script src="/content/script_inscription_id"></script>test</html>`)
};

const revealPayment = btc.p2tr(
  undefined, // internalPubKey
  ordinals.p2tr_ord_reveal(pubKey, [inscription]), // TaprootScriptTree
  TESTNET, // mainnet or testnet
  false, // allowUnknownOutputs, safety feature
  customScripts // how to handle custom scripts
);

// We need to send some bitcoins to this address before reveal.
// Also, there should be enough to cover reveal tx fee.
console.log('Address', revealPayment.address); // 'tb1p5mykwcq5ly7y2ctph9r2wfgldq94eccm2t83dd58k785p0zqzwkspyjkp5'

// Be extra careful: it's possible to accidentally send an inscription as a fee.
// Also, rarity is only available with ordinal wallet.
// But you can parse other inscriptions and create a common one using this.
const changeAddr = revealPayment.address; // can be different
const revealAmount = 2000n;
const fee = 500n;

const tx = new btc.Transaction({ customScripts });
tx.addInput({
  ...revealPayment,
  // This is txid of tx with bitcoins we sent (replace)
  txid: '75ddabb27b8845f5247975c8a5ba7c6f336c4570708ebe230caf6db5217ae858',
  index: 0,
  witnessUtxo: { script: revealPayment.script, amount: revealAmount },
});
tx.addOutputAddress(changeAddr, revealAmount - fee, TESTNET);
tx.sign(privKey, undefined, new Uint8Array(32));
tx.finalize();

const txHex = hex.encode(tx.extract());
console.log(txHex); // Hex of reveal tx to broadcast
const tx2 = btc.Transaction.fromRaw(hex.decode(txHex)); // Parsing inscriptions
console.log('parsed', ordinals.parseWitness(tx2.inputs[0].finalScriptWitness));
console.log('vsize', tx2.vsize); // Reveal tx should pay at least this much fee
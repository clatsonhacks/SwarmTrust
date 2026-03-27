import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

for (let i = 1; i <= 5; i++) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`ROBOT_${i}_PRIVATE_KEY=${privateKey}`);
  console.log(`ROBOT_${i}_ADDRESS=${account.address}`);
  console.log();
}
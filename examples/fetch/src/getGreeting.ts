export function getGreeting(name: string): Promise<{ greeting: string }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Fail half of the time, so that the failure state is reachable
      if (Math.random() < 0.5) {
        reject(new Error('Could not fetch greeting'));
        return;
      }

      resolve({ greeting: `Hello, ${name}!` });
    }, 1000);
  });
}

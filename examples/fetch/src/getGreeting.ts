export async function getGreeting(name: string): Promise<{ greeting: string }> {
  return new Promise((res, rej) => {
    setTimeout(() => {
      if (Math.random() < 0.5) {
        rej();
        return;
      }
      res({
        greeting: `Hello, ${name}!`
      });
    }, 1000);
  });
}

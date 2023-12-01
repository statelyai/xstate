---
'xstate': minor
---

Input types can now be specified for machines:

```ts
const emailMachine = createMachine({
  types: {} as {
    input: {
      subject: string;
      message: string;
    };
  },
  context: ({ input }) => ({
    // Strongly-typed input!
    emailSubject: input.subject,
    emailBody: input.message.trim()
  })
});

const emailActor = interpret(emailMachine, {
  input: {
    // Strongly-typed input!
    subject: 'Hello, world!',
    message: 'This is a test.'
  }
}).start();
```

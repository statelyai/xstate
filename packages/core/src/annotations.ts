const x: any = {};

const createUser = async (
  email: string,
  age: number
): Promise<{ id: string }> => {};

const emailUserInUS = (email: string): Promise<void> => {};

const reportCouldNotEmailUser = (email: string): void => {};

const createUserHandler = async (email: string, age: number) => {
  // x.run acts as an implicit state
  const user = await x.run(
    () => createUser(email, age),
    {
      // Throws an error with this message
      onError: x.throw('Could not create user')
    },
    {
      // Provides the visualiser with a name for this state
      name: 'Creating user'
    }
  );

  await x.run(
    () =>
      x.if([
        {
          cond: () => emailEndsInCoDotUk(email),
          then: () => x.run(() => emailUserInUK(email))
        },
        {
          then: emailUserInUS(email)
        }
      ]),
    {
      name: 'Emailing user',
      onError: {
        result: x.continue(),
        actions: () => x.run(() => reportCouldNotEmailUser(email))
      }
    }
  );

  // Acts as a 'final state'
  return x.result({
    id: user.id
  });
};

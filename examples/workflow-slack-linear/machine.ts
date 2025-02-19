import { assign, createMachine, fromPromise } from 'xstate';

const createSlackPost = fromPromise(
  async ({
    input
  }: {
    input: {
      channel: string;
    };
  }) => {
    // TODO: add Slack integration here
  }
);

export const machine = createMachine({
  id: 'linear-issues-daily-slack-alert',
  types: {
    input: {} as {
      text: string;
    },
    context: {} as {
      issues: { nodes: any[] } | null;
    },
    actors: {} as
      | {
          src: 'Linear.getIssues';
          logic: any;
        }
      | {
          src: 'Slack.postMessage';
          logic: typeof createSlackPost;
        }
      | {
          src: 'cron';
          logic: any;
        },
    events: {} as { type: 'cron' }
  },
  context: ({ input }) => ({
    issues: null
  }),
  invoke: {
    src: 'cron',
    input: {
      cron: '0 9 * * 1,2,3,4,5'
    }
  },
  initial: 'Get in-progress issues',
  states: {
    idle: {
      on: {
        cron: { target: 'Get in-progress issues' }
      }
    },
    'Get in-progress issues': {
      invoke: {
        src: 'Linear.getIssues',
        input: ({ context }) => ({
          first: 20,
          filter: {
            team: {
              id: {
                // To get your Team id from within Linear, hit CMD+K and "Copy model UUID"
                eq: '<your-team-uuid>'
              }
            },
            assignee: {
              email: {
                eq: '<assignee-email-address>'
              }
            },
            state: {
              name: {
                eq: 'In Progress'
              }
            }
          }
        }),
        onDone: {
          actions: assign({
            issues: ({ event }) => event.output
          }),
          target: 'Post to Slack'
        }
      }
    },
    'Post to Slack': {
      invoke: {
        src: 'Slack.postMessage',
        input: ({ context }) => ({
          channel: process.env.SLACK_CHANNEL_ID!,
          // Include text for notifications and blocks to get a rich Slack message in the channel
          text: `You have ${
            context.issues!.nodes.length
          } 'In Progress' issues in Linear!`,
          // Create rich Slack messages with the Block Kit builder https://app.slack.com/block-kit-builder/
          blocks: context.issues!.nodes.flatMap((issue) => [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `⏳ *${issue.title}*`
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View issue',
                  emoji: true
                },
                value: 'click_me_123',
                url: issue.url,
                action_id: 'button-action'
              }
            },
            {
              type: 'divider'
            }
          ])
        })
      },
      onDone: { target: 'idle' }
    }
  }
});

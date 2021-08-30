// import { createMachine, forwardTo, send, sendParent, actions } from "xstate";

// export const anotherMachine = createMachine({});

// const allTheStops = (params: any) => {
//   const actions = params.actions;
//   const src = params.src;
//   const cond = params.cond;
//   return createMachine({
//     initial: "idle",
//     on: {
//       GO: [
//         {
//           cond,
//         },
//         {
//           cond: params.cond,
//         },
//         {
//           cond: cond,
//         },
//       ],
//     },
//     states: {
//       idle: {
//         entry: [
//           // sendParent("HELLO"),
//           // sendParent({
//           //   type: "HELLO",
//           // }),
//           // sendParent(
//           //   {
//           //     type: "HELLO",
//           //   },
//           //   {
//           //     delay: 20,
//           //     id: "id",
//           //     to: "hey",
//           //   },
//           // ),
//           // sendParent(() => ({
//           //   type: "HELLO",
//           // })),
//           // send(
//           //   () => {
//           //     return {
//           //       type: "HELLO",
//           //     };
//           //   },
//           //   {
//           //     delay: 20,
//           //     id: "id",
//           //     to: "hey",
//           //   },
//           // ),
//         ],
//         on: {
//           AWESOME: {
//             actions: [
//               // forwardTo("wow"),
//               // () => {},
//               // actions.raise({ type: "YOU_RAISE_ME_UP" }),
//               // actions.respond({
//               //   type: "YOU RESPOND TO ME",
//               // }),
//               // actions.sendUpdate(),
//               // actions.escalate({
//               //   type: "ESCALATION",
//               // }),
//               params.actions,
//               actions,
//             ],
//           },
//         },
//         invoke: [
//           {
//             // autoForward: true,
//             src: async () => {},
//             // Similar to context: not possible and
//             // probably not desirable
//             // data: {},
//             onError: {
//               target: "next",
//             },
//             id: "yeah",
//           },
//           // This is currently very hard, need to
//           // grab the reference to the machine and
//           // copy it. Shimming it for now
//           // {
//           //   id: "anotherMachine",
//           //   src: anotherMachine,
//           // },
//           {
//             src: "",
//           },
//           {
//             src: params.src,
//           },
//           {
//             src,
//           },
//         ],
//       },
//     },
//   });
// };

// export const yeah = allTheStops({
//   actions: () => {},
//   src: () => {},
//   cond: () => {},
// });

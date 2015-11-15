{
  const State = require('../state');
  const Machine = require('../machine');
}

Machine
= states:State*
{
  if (states.length) {
    states[0].initial = true;
  }
  
  return new Machine({ states: states });
}

States
= ws* "{" states:State* "}" ws*
{
  if (states.length) {
    states[0].initial = true;
  }

  return states;
}

State
= ws* id:StateId ws* final:FinalToken? ws* states:States? ws* transitions:Transition* ws*
{
  return {
    id: id,
    final: !!final,
    states: states || [],
    transitions: transitions.map(t => ({
      target: t.target === true ? id : t.target,
      event: t.event
    }))
  };
}

StateId = id:identifier+
{
  return id.join('');
}


Transition
= "->" ws* target:StateId event:Signal? 
  {
    return { target, event }
  }
/ "<-" ws* event:Signal?
  {
    return { target: true, event }
  }

Signal
= ws* "(" ws* type:SignalType ws* ")" ws*
{
  return type;
}

SignalType
= identifier

FinalToken
= final:"!" {
  return !!final;
}

ws
= [ \n\t]

identifier
= id:[a-z0-9\_]i+ {
  return id.join('')
}
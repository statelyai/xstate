Machine
= states:State*
{
  return {
    states
  }
}

States
= "{" states:State* "}"
{
  return states
}

State
= id:StateId ws* final:FinalToken ws* states:States? transitions:Transition*
{
  return {
    id: id,
    final,
    states: states || [],
    transitions: transitions.map(t => ({
      target: t.target === true ? id : t.target,
      event: t.event
    }))
  }
}

StateId = id:identifier+ ws*
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
= final:"!"? {
  return !!final;
}

ws
= [ \n\t]

identifier
= id:[a-z0-9\-\_]i+ {
  return id.join('')
}
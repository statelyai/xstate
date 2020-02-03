const formatFiniteState = (finiteState) => {
  if (typeof finiteState === 'string') {
    return finiteState
  } else if (typeof finiteState === 'object') {
    const parentStateKeys = Object.keys(finiteState)
    if ((parentStateKeys.length > 1)) {
      return finiteState
    } else if (parentStateKeys.length === 1) {
      const parentStateKey = parentStateKeys[0]
      return parentStateKey + '.' + formatFiniteState(finiteState[parentStateKey])
    }
  }
}

export default formatFiniteState
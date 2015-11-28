'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _redux = require('redux');

var _reactRedux = require('react-redux');

var _index = require('../../../lib/index');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var vendingMachine = (0, _index.machine)('\nidle {\n  idle\n    -> err_insert_coin (SELECT)\n  dispensed\n    -> err_insert_coin (SELECT)\n  err_insert_coin\n    <- (SELECT)\n} -> wait_for_select (COIN)\n\nwait_for_select {\n  idle \n    -> err_processing (COIN)\n  err_processing\n    <- (COIN)\n} -> dispensing (SELECT)\n\ndispensing {\n  idle\n    -> err_dispensing (COIN)\n    -> err_dispensing (SELECT)\n  err_dispensing\n    <- (SELECT)\n    <- (COIN)\n} -> idle.dispensed (DISPENSED)\n');

var messages = {
  'idle.dispensed': 'Enjoy your drink! Please insert a coin for another.',
  'idle.err_insert_coin': 'ERROR: Please insert a coin before making a selection.',
  'wait_for_select.err_processing': 'ERROR: Why are you giving me more coins? Make a selection',
  'dispensing.err_dispensing': 'ERROR: Please wait until your drink is dispensed.'
};

var title = {
  'idle': 'Please insert a coin.',
  'wait_for_select': 'Please make a selection.',
  'dispensing': 'Please wait; dispensing your selection.'
};

var store = (0, _redux.createStore)((0, _redux.combineReducers)({
  vending: (0, _index.stateReducer)(vendingMachine)
}));

var App = (function (_React$Component) {
  _inherits(App, _React$Component);

  function App() {
    _classCallCheck(this, App);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(App).apply(this, arguments));
  }

  _createClass(App, [{
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps(nextProps) {
      var _props = this.props;
      var vending = _props.vending;
      var dispatch = _props.dispatch;

      var action = (0, _index.mapOnEntry)({
        'dispensing': { type: 'DISPENSED' }
      }, nextProps.vending, vending);

      if (action) {
        setTimeout(function () {
          return dispatch(action);
        }, 2000);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props2 = this.props;
      var dispatch = _props2.dispatch;
      var vending = _props2.vending;

      return _react2.default.createElement(
        'div',
        null,
        _react2.default.createElement(
          'h3',
          null,
          (0, _index.mapState)(title, vending)
        ),
        _react2.default.createElement(
          'button',
          { onClick: function onClick() {
              return dispatch({ type: 'COIN' });
            } },
          'COIN'
        ),
        _react2.default.createElement(
          'button',
          { onClick: function onClick() {
              return dispatch({ type: 'SELECT' });
            } },
          'SELECT'
        ),
        _react2.default.createElement(
          'div',
          null,
          (0, _index.mapState)(messages, vending)
        )
      );
    }
  }]);

  return App;
})(_react2.default.Component);

var ConnectedApp = (0, _reactRedux.connect)(function (s) {
  return s;
})(App);

var appElement = document.createElement('div');

document.body.appendChild(appElement);

_reactDom2.default.render(_react2.default.createElement(
  _reactRedux.Provider,
  { store: store },
  _react2.default.createElement(ConnectedApp, null)
), appElement);

( function ( exports ) {

  /**
  * Validator
  */

  var Validator = function () {
    this.__class__ = 'Validator';

    return this;
  };

  Validator.prototype = {

    constructor: Validator,

    validate: function ( objectOrString, AssertsOrConstraint, group ) {
      if ( 'string' === typeof objectOrString) {
        return this._validateString( objectOrString, AssertsOrConstraint, group );
      }

      return this._validateObject( objectOrString, AssertsOrConstraint, group );
    },

    _validateString: function ( string, assert, group ) {
      var result, failures = [];

      if ( !_isArray( assert ) )
        assert = [ assert ];

      for ( var i = 0; i < assert.length; i++ ) {
        if ( ! ( assert[ i ] instanceof Assert) )
          throw new Error( 'You must give an Assert or an Asserts array to validate a string' );

        result = assert[ i ].check( string, group );

        if ( result instanceof Violation )
          failures.push( result );
      }

      return failures;
    },

    _validateObject: function ( object, constraint, group ) {
      if ( 'object' !== typeof constraint )
        throw new Error( 'You must give an object or a Constraint' );

      if ( ! ( constraint instanceof Constraint ) )
        constraint = new Constraint( constraint );

      return constraint.check( object, group );
    }
  };

  Validator.const = {
    must_be_a_string: 'must_be_a_string'
  };

  /**
  * Constraint
  */

  var Constraint = function ( data ) {
    this.__class__ = 'Constraint';

    this.nodes = {};

    if ( data ) {
      try {
        this._bootstrap( data );
      } catch ( err ) {
        throw new Error( 'Should give a valid mapping object to Constraint', err, data );
      }
    }

    return this;
  };

  Constraint.prototype = {

    constructor: Constraint,

    check: function ( object, group ) {
      var result, failures = {};

      for ( var property in object ) {
        if ( this.has( property ) ) {
          result = this._check( property, object[ property ], group );

          // check returned an array of Violations or an object mapping Violations
          if ( ( _isArray( result ) && result.length > 0 ) || ( !_isArray( result ) && !_isEmptyObject( result ) ) )
            failures[ property ] = result;
        }
      }

      return failures;
    },

    add: function ( node, object ) {
      if ( object instanceof Assert  || ( _isArray( object ) && object[ 0 ] instanceof Assert ) ) {
        this.nodes[ node ] = object;

        return this;
      }

      if ( 'object' === typeof object && !_isArray( object ) ) {
        this.nodes[ node ] = object instanceof Constraint ? object : new Constraint( object );

        return this;
      }

      throw new Error( 'Should give an Assert, an Asserts array, a Constraint', object );
    },

    has: function ( node ) {
      return 'undefined' !== typeof this.nodes[ node.toLowerCase() ];
    },

    get: function ( node, placeholder ) {
      return 'undefined' !== typeof this.nodes[ node ] ? this.nodes[ node ] : placeholder || null;
    },

    remove: function ( node ) {
      var _nodes = [];

      for ( var i in this.nodes )
        if ( i !== node )
          _nodes[ i ] = this.nodes[ i ];

      this.nodes = _nodes;

      return this;
    },

    _bootstrap: function ( data ) {
      for ( var node in data )
        this.add( node, data[ node ] );
    },

    _check: function ( node, value, group ) {
      // Assert
      if ( this.nodes[ node ] instanceof Assert )
        return this._checkAsserts( value, [ this.nodes[ node ] ], group );

      // Asserts
      if ( _isArray( this.nodes[ node ] ) )
        return this._checkAsserts( value, this.nodes[ node ], group );

      // Constraint -> check api
      if ( this.nodes[ node ] instanceof Constraint )
        return this.nodes[ node ].check( value, group );

      throw new Error( 'Invalid node', this.nodes[ node ] );
    },

    _checkAsserts: function ( value, asserts, group ) {
      var result, failures = [];

      for ( var i = 0; i < asserts.length; i++ ) {
        result = asserts[ i ].check( value, group );

        if ( result instanceof Violation )
          failures.push( result );
      }

      return failures;
    }
  };

  /**
  * Violation
  */

  var Violation = function ( assert, value, violation ) {
    this.__class__ = 'Violation';

    if ( ! ( assert instanceof Assert ) )
      throw new Error( 'Should give an assertion implementing the Assert interface' );

    this.assert = assert.__class__;
    this.value = value;
    this.violation = violation;
  };

  Violation.prototype = {
    show: function () {
      return {
        assert: this.assert,
        value: this.value,
        violation: this.violation
      };
    },

    __toString: function () {
      if ( 'undefined' !== typeof this.violation )
        var violation = '", ' + this.getViolation().constraint + ' expected was ' + this.getViolation().expected;

      return this.assert + ' assert failed for "' + this.value + violation || '';
    },

    getViolation: function () {
      var constraint, expected;

      for ( constraint in this.violation )
        expected = this.violation[ constraint ];

      return { constraint: constraint, expected: expected };
    }
  };

  /**
  * Assert
  */

  var Assert = function ( group ) {
    this.__class__ = 'Assert';
    this.__parentClass__ = this.__class__;
    this.groups = [];

    if ( 'undefined' !== typeof group )
      this.addGroup( group );

    return this;
  };

  Assert.prototype = {

    construct: Assert,

    check: function ( value, group ) {
      if ( group && !this.hasGroup( group ) )
        return;

      if ( !group && this.hasGroups() )
        return;

      try {
        this.validate( value );
      } catch ( violation ) {
        return violation;
      }
    },

    hasGroup: function ( group ) {
      if ( 'string' !== typeof group )
        return this.hasOneOf( group );

      // Asserts with no group also respond to "Default" group. Else return false
      if ( !this.hasGroups() )
        return 'Default' === group;

      return -1 !== this.groups.indexOf( group );
    },

    hasOneOf: function ( groups ) {
      for ( var i = 0; i < groups.length; i++ )
        if ( this.hasGroup( groups[ i ] ) )
          return true;

      return false;
    },

    hasGroups: function () {
      return this.groups.length > 0;
    },

    addGroup: function ( group ) {
      if ( _isArray( group ) )
        return this.addGroups( group );

      if ( !this.hasGroup( group ) )
        this.groups.push( group );

      return this;
    },

    removeGroup: function ( group ) {
      var _groups = [];

      for ( var i = 0; i < this.groups.length; i++ )
        if ( group !== this.groups[ i ] )
          _groups.push( this.groups[ i ] );

      this.groups = _groups;

      return this;
    },

    addGroups: function ( groups ) {
      for ( var i = 0; i < groups.length; i++ )
        this.addGroup( groups[ i ] );

      return this;
    },

    /**
    * Asserts definitions
    */

    NotNull: function () {
      this.__class__ = 'NotNull';

      this.validate = function ( value ) {
        if ( null === value || 'undefined' === typeof value )
          throw new Violation( this, value );

        return true;
      };

      return this;
    },

    Null: function () {
      this.__class__ = 'Null';

      this.validate = function ( value ) {
        if ( null !== value )
          throw new Violation( this, value );

        return true;
      };

      return this;
    },

    NotBlank: function () {
      this.__class__ = 'NotBlank';

      this.validate = function ( value ) {
        if ( 'string' !== typeof value )
          throw new Violation( this, value, { value: Validator.const.must_be_a_string } );

        if ( '' === value.replace( /^\s+/g, '' ).replace( /\s+$/g, '' ) )
          throw new Violation( this, value );

        return true;
      };

      return this;
    },

    Blank: function () {
      this.__class__ = 'Blank';

      this.validate = function ( value ) {
        if ( 'string' !== typeof value )
          throw new Violation( this, value, { value: Validator.const.must_be_a_string } );

        if ( '' !== value.replace( /^\s+/g, '' ).replace( /\s+$/g, '' ) )
          throw new Violation( this, value );

        return true;
      };

      return this;
    },

    Length: function ( boundaries ) {
      this.__class__ = 'Length';

      if ( !boundaries.min && !boundaries.max )
        throw new Error( 'Lenth assert needs { min: x, max: y } object' );

      this.min = boundaries.min;
      this.max = boundaries.max;

      this.validate = function ( value ) {
        if ( 'string' !== typeof value )
          throw new Violation( this, value, { value: Validator.const.must_be_a_string } );

        if ( 'undefined' !== typeof this.min && this.min === this.max && value.length !== this.min )
          throw new Violation( this, value, { min: this.min, max: this.max } );

        if ( 'undefined' !== typeof this.max && value.length > this.max )
          throw new Violation( this, value, { max: this.max } );

        if ( 'undefined' !== typeof this.min && value.length < this.min )
          throw new Violation( this, value, { min: this.min } );

        return true;
      };

      return this;
    },

    Email: function () {
      this.__class__ = 'Email';

      this.validate = function ( value ) {
        var regExp = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i;

        if ( 'string' !== typeof value )
          throw new Violation( this, value, { value: Validator.const.must_be_a_string } );

        if ( !regExp.test( value ) )
          throw new Violation( this, value );

        return true;
      };

      return this;
    }
  };

  // expose to the world these awesome classes
  exports.Assert = Assert;
  exports.Validator = Validator;
  exports.Violation = Violation;
  exports.Constraint = Constraint;

  /**
  * Some useful object prototypes / functions here
  */

  // IE8<= compatibility
  // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf
  if (!Array.prototype.indexOf)
    Array.prototype.indexOf = function (searchElement /*, fromIndex */ ) {
        "use strict";
        if (this == null) {
            throw new TypeError();
        }
        var t = Object(this);
        var len = t.length >>> 0;
        if (len === 0) {
            return -1;
        }
        var n = 0;
        if (arguments.length > 1) {
            n = Number(arguments[1]);
            if (n != n) { // shortcut for verifying if it's NaN
                n = 0;
            } else if (n != 0 && n != Infinity && n != -Infinity) {
                n = (n > 0 || -1) * Math.floor(Math.abs(n));
            }
        }
        if (n >= len) {
            return -1;
        }
        var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
        for (; k < len; k++) {
            if (k in t && t[k] === searchElement) {
                return k;
            }
        }
        return -1;
    };

  // Test if object is empty, useful for Constraint violations check
  _isEmptyObject = function ( obj ) {
    for ( var property in obj )
      return false;

    return true;
  };

  function _isArray ( obj ) {
    return Object.prototype.toString.call( obj ) === '[object Array]';
  }

} )( 'undefined' === typeof exports ? this[ validatorjs_ns || 'Validator' ] = {} : exports );
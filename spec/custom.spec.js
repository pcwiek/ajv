'use strict';

var getAjvInstances = require('./ajv_instances')
  , should = require('chai').should()
  , equal = require('../lib/compile/equal')
  , doT = require('dot');


describe('Custom keywords', function () {
  var ajv, instances;

  beforeEach(function() {
    instances = getAjvInstances({
      allErrors:    true,
      verbose:      true,
      inlineRefs:   false,
      i18n:         true
    });
    ajv = instances[0];
  });


  describe('custom rules', function() {
    var compileCount = 0;

    it('should add and validate rule with "interpreted" keyword validation', function() {
      testAddEvenKeyword({ type: 'number', validate: validateEven });

      function validateEven(schema, data) {
        if (typeof schema != 'boolean') throw new Error('The value of "even" keyword must be boolean');
        return data % 2 ? !schema : schema;
      }
    });

    it('should add and validate rule with "compiled" keyword validation', function() {
      testAddEvenKeyword({ type: 'number', compile: compileEven });

      function compileEven(schema) {
        if (typeof schema != 'boolean') throw new Error('The value of "even" keyword must be boolean');
        return schema ? isEven : isOdd;
      }

      function isEven(data) { return data % 2 === 0; }
      function isOdd(data) { return data % 2 !== 0; }
    });

    it('should compile keyword validating function only once per schema', function () {
      instances.forEach(function (ajv) {
        ajv.addKeyword('constant', { compile: compileConstant });

        var schema = { "constant": "abc" };
        compileCount = 0;
        var validate = ajv.compile(schema);
        should.equal(compileCount, 1);

        shouldBeValid(validate, 'abc');
        shouldBeInvalid(validate, 2);
        shouldBeInvalid(validate, {});
      });
    });

    it('should allow multiple schemas for the same keyword', function () {
      instances.forEach(function (ajv) {
        ajv.addKeyword('constant', { compile: compileConstant });

        var schema = {
          "properties": {
            "a": { "constant": 1 },
            "b": { "constant": 1 }
          },
          "additionalProperties": { "constant": { "foo": "bar" } },
          "items": { "constant": { "foo": "bar" } }
        };
        compileCount = 0;
        var validate = ajv.compile(schema);
        should.equal(compileCount, 2);

        shouldBeValid(validate, {a:1, b:1});
        shouldBeInvalid(validate, {a:2, b:1});

        shouldBeValid(validate, {a:1, c: {foo: 'bar'}});
        shouldBeInvalid(validate, {a:1, c: {foo: 'baz'}});

        shouldBeValid(validate, [{foo: 'bar'}]);
        shouldBeValid(validate, [{foo: 'bar'}, {foo: 'bar'}]);

        shouldBeInvalid(validate, [1]);
      });
    });

    it('should pass parent schema to "interpreted" keyword validation', function() {
      testRangeKeyword({ type: 'number', validate: validateRange });

      function validateRange(schema, data, parentSchema) {
        validateRangeSchema(schema, parentSchema);

        return parentSchema.exclusiveRange === true
                ? data > schema[0] && data < schema[1]
                : data >= schema[0] && data <= schema[1];
      }
    });

    it('should pass parent schema to "compiled" keyword validation', function() {
      testRangeKeyword({ type: 'number', compile: compileRange });
    });

    it('should allow multiple parent schemas for the same keyword', function () {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { type: 'number', compile: compileRange });

        var schema = {
          "properties": {
            "a": { "range": [2, 4], "exclusiveRange": true },
            "b": { "range": [2, 4], "exclusiveRange": false }
          },
          "additionalProperties": { "range": [5, 7] },
          "items": { "range": [5, 7] }
        };
        compileCount = 0;
        var validate = ajv.compile(schema);
        should.equal(compileCount, 3);

        shouldBeValid(validate, {a:3.99, b:4});
        shouldBeInvalid(validate, {a:4, b:4});

        shouldBeValid(validate, {a:2.01, c: 7});
        shouldBeInvalid(validate, {a:2.01, c: 7.01});

        shouldBeValid(validate, [5, 6, 7]);
        shouldBeInvalid(validate, [7.01]);
      });
    });

    function compileConstant(schema) {
      compileCount++;
      return typeof schema == 'object' && schema !== null
              ? isDeepEqual
              : isStrictEqual;

      function isDeepEqual(data) { return equal(data, schema); }
      function isStrictEqual(data) { return data === schema; }
    }

    function compileRange(schema, parentSchema) {
      compileCount++;
      validateRangeSchema(schema, parentSchema);

      var min = schema[0];
      var max = schema[1];

      return parentSchema.exclusiveRange === true
              ? function (data) { return data > min && data < max; }
              : function (data) { return data >= min && data <= max; }
    }
  });


  describe('macro rules', function() {
    it('should add and validate rule with "macro" keyword', function() {
      testAddEvenKeyword({ macro: macroEven });
    });

    it('should add and expand macro rule', function() {
      instances.forEach(function (ajv) {
        try {
        ajv.addKeyword('constant', { macro: macroConstant });

        var schema = { "constant": "abc" };
        var validate = ajv.compile(schema);

        shouldBeValid(validate, 'abc');
        shouldBeInvalid(validate, 2);
        shouldBeInvalid(validate, {});
        } catch(e) {
          console.log(e.stack);
          console.log(validate.toString());
          throw e;
        }
      });
    });

    it('should allow multiple schemas for the same macro keyword', function () {
      instances.forEach(function (ajv) {
        ajv.addKeyword('constant', { macro: macroConstant });

        var schema = {
          "properties": {
            "a": { "constant": 1 },
            "b": { "constant": 1 }
          },
          "additionalProperties": { "constant": { "foo": "bar" } },
          "items": { "constant": { "foo": "bar" } }
        };
        var validate = ajv.compile(schema);

        shouldBeValid(validate, {a:1, b:1});
        shouldBeInvalid(validate, {a:2, b:1});

        shouldBeValid(validate, {a:1, c: {foo: 'bar'}});
        shouldBeInvalid(validate, {a:1, c: {foo: 'baz'}});

        shouldBeValid(validate, [{foo: 'bar'}]);
        shouldBeValid(validate, [{foo: 'bar'}, {foo: 'bar'}]);

        shouldBeInvalid(validate, [1]);
      });
    });

    it('should pass parent schema to "macro" keyword', function() {
      testRangeKeyword({ macro: macroRange });
    });

    it('should allow multiple parent schemas for the same macro keyword', function () {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { macro: macroRange });

        var schema = {
          "properties": {
            "a": { "range": [2, 4], "exclusiveRange": true },
            "b": { "range": [2, 4], "exclusiveRange": false }
          },
          "additionalProperties": { "range": [5, 7] },
          "items": { "range": [5, 7] }
        };
        var validate = ajv.compile(schema);

        shouldBeValid(validate, {a:3.99, b:4});
        shouldBeInvalid(validate, {a:4, b:4});

        shouldBeValid(validate, {a:2.01, c: 7});
        shouldBeInvalid(validate, {a:2.01, c: 7.01});

        shouldBeValid(validate, [5, 6, 7]);
        shouldBeInvalid(validate, [7.01]);
      });
    });

    it('should recursively expand macro keywords', function() {
      instances.forEach(function (ajv) {
        ajv.addKeyword('deepProperties', { macro: macroDeepProperties });
        ajv.addKeyword('range', { macro: macroRange });

        var schema = {
          "deepProperties": {
            "a.b.c": { "type": "number", "range": [2,4] },
            "d.e.f.g": { "type": "string" }
          }
        };

        /* This schema recursively expands to:
        {
          "allOf": [
            {
              "properties": {
                "a": {
                  "properties": {
                    "b": {
                      "properties": {
                        "c": {
                          "type": "number",
                          "minimum": 2,
                          "exclusiveMinimum": false,
                          "maximum": 4,
                          "exclusiveMaximum": false
                        }
                      }
                    }
                  }
                }
              }
            },
            {
              "properties": {
                "d": {
                  "properties": {
                    "e": {
                      "properties": {
                        "f": {
                          "properties": {
                            "g": {
                              "type": "string"
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        }
        */

        var validate = ajv.compile(schema);

        shouldBeValid(validate, {
          a: {b: {c: 3}},
          d: {e: {f: {g: 'foo'}}}
        });

        shouldBeInvalid(validate, {
          a: {b: {c: 5}}, // out of range
          d: {e: {f: {g: 'foo'}}}
        });

        shouldBeInvalid(validate, {
          a: {b: {c: 'bar'}}, // not number
          d: {e: {f: {g: 'foo'}}}
        });

        shouldBeInvalid(validate, {
          a: {b: {c: 3}},
          d: {e: {f: {g: 2}}} // not string
        });

        function macroDeepProperties(schema) {
          if (typeof schema != 'object')
            throw new Error('schema of deepProperty should be an object');

          var expanded = [];

          for (var prop in schema) {
            var path = prop.split('.');
            var properties = {};
            if (path.length == 1) {
              properties[prop] = schema[prop];
            } else {
              var deepProperties = {};
              deepProperties[path.slice(1).join('.')] = schema[prop];
              properties[path[0]] = { "deepProperties": deepProperties };
            }
            expanded.push({ "properties": properties });
          }

          return expanded.length == 1 ? expanded[0] : { "allOf": expanded };
        }
      });
    });

    it('should correctly expand multiple macros on the same level', function() {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { macro: macroRange });
        ajv.addKeyword('even', { macro: macroEven });

        var schema = {
          "range": [4,6],
          "even": true
        };

        var validate = ajv.compile(schema);
        var numErrors = ajv.opts.allErrors ? 2 : 1;

        shouldBeInvalid(validate, 2);
        shouldBeInvalid(validate, 3, numErrors);
        shouldBeValid(validate, 4);
        shouldBeInvalid(validate, 5);
        shouldBeValid(validate, 6);
        shouldBeInvalid(validate, 7, numErrors);
        shouldBeInvalid(validate, 8);
      });
    });

    it('should use "allOf" keyword if macro schemas cannot be merged', function() {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { macro: macroRange });

        var schema = {
          "range": [1,4],
          "minimum": 2.5
        };

        var validate = ajv.compile(schema);
        validate.schema.allOf .should.be.an('array');
        validate.schema.allOf .should.have.length(2);

        shouldBeValid(validate, 3);
        shouldBeInvalid(validate, 2);
      });
    });

    it('should correctly expand macros in subschemas', function() {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { macro: macroRange });

        var schema = {
          "allOf": [
            { "range": [4,8] },
            { "range": [2,6] }
          ]
        }

        var validate = ajv.compile(schema);

        shouldBeInvalid(validate, 2);
        shouldBeInvalid(validate, 3);
        shouldBeValid(validate, 4);
        shouldBeValid(validate, 5);
        shouldBeValid(validate, 6);
        shouldBeInvalid(validate, 7);
        shouldBeInvalid(validate, 8);
      });
    });

    it('should correctly expand macros in macro expansions', function() {
      instances.forEach(function (ajv) {
        ajv.addKeyword('range', { macro: macroRange });
        ajv.addKeyword('contains', { macro: macroContains });

        var schema = {
          "contains": {
            "type": "number",
            "range": [4,7],
            "exclusiveRange": true
          }
        };

        var validate = ajv.compile(schema);

        shouldBeInvalid(validate, [1,2,3]);
        shouldBeInvalid(validate, [2,3,4]);
        shouldBeValid(validate, [3,4,5]); // only 5 is in range
        shouldBeValid(validate, [6,7,8]); // only 6 is in range
        shouldBeInvalid(validate, [7,8,9]);
        shouldBeInvalid(validate, [8,9,10]);

        function macroContains(schema) {
          return { "not": { "items": { "not": schema } } };
        }
      });
    });

    it('should throw exception is macro expansion is an invalid schema', function() {
      ajv.addKeyword('invalid', { macro: macroInvalid });
      var schema = { "invalid": true };

      should.throw(function() {
        var validate = ajv.compile(schema);
      });

      function macroInvalid(schema) {
        return { "type": "invalid" };
      }
    });

    function macroEven(schema) {
      if (schema === true) return { "multipleOf": 2 };
      if (schema === false) return { "not": { "multipleOf": 2 } };
      throw new Error('Schema for "even" keyword should be boolean');
    }

    function macroConstant(schema, parentSchema) {
      return { "enum": [schema] };
    }

    function macroRange(schema, parentSchema) {
      validateRangeSchema(schema, parentSchema);
      var exclusive = !!parentSchema.exclusiveRange;

      return {
        minimum: schema[0],
        exclusiveMinimum: exclusive,
        maximum: schema[1],
        exclusiveMaximum: exclusive
      };
    }
  });


  describe('inline rules', function() {
    it('should add and validate rule with "inline" code keyword', function() {
      testAddEvenKeyword({ type: 'number', inline: inlineEven });
    });

    it('should pass parent schema to "inline" keyword', function() {
      testRangeKeyword({ type: 'number', inline: inlineRange, statements: true });
    });

    it('should define "inline" keyword as template', function() {
      var inlineRangeTemplate = doT.compile("\
{{ \
  var $data = 'data' + (it.dataLevel || '') \
    , $min = it.schema.range[0] \
    , $max = it.schema.range[1] \
    , $gt = it.schema.exclusiveRange ? '>' : '>=' \
    , $lt = it.schema.exclusiveRange ? '<' : '<='; \
}} \
var valid{{=it.lvl}} = {{=$data}} {{=$gt}} {{=$min}} && {{=$data}} {{=$lt}} {{=$max}}; \
");

      testRangeKeyword({
        type: 'number',
        inline: inlineRangeTemplate,
        parentSchema: true,
        statements: true
      });
    });

    function inlineEven(it, schema) {
      var op = schema ? '===' : '!==';
      return 'data' + (it.dataLevel || '') + ' % 2 ' + op + ' 0';
    }

    function inlineRange(it, schema, parentSchema) {
      var min = schema[0]
        , max = schema[1]
        , data = 'data' + (it.dataLevel || '')
        , gt = parentSchema.exclusiveRange ? ' > ' : ' >= '
        , lt = parentSchema.exclusiveRange ? ' < ' : ' <= ';
      return 'var valid' + it.lvl + ' = ' + data + gt + min + ' && ' + data + lt + max + ';';
    }
  });


  function testAddEvenKeyword(definition) {
    instances.forEach(function (ajv) {
      ajv.addKeyword('even', definition);
      var schema = { "even": true };
      var validate = ajv.compile(schema);

      shouldBeValid(validate, 2);
      shouldBeValid(validate, 'abc');
      shouldBeInvalid(validate, 2.5);
      shouldBeInvalid(validate, 3);
    });
  }

  function testRangeKeyword(definition) {
    instances.forEach(function (ajv) {
      ajv.addKeyword('range', definition);

      var schema = { "range": [2, 4] };
      var validate = ajv.compile(schema);

      shouldBeValid(validate, 2);
      shouldBeValid(validate, 3);
      shouldBeValid(validate, 4);
      shouldBeValid(validate, 'abc');

      shouldBeInvalid(validate, 1.99);
      shouldBeInvalid(validate, 4.01);

      var schema = {
        "properties": {
          "foo": {
            "range": [2, 4],
            "exclusiveRange": true
          }
        }
      };
      var validate = ajv.compile(schema);

      shouldBeValid(validate, { foo: 2.01 });
      shouldBeValid(validate, { foo: 3 });
      shouldBeValid(validate, { foo: 3.99 });

      shouldBeInvalid(validate, { foo: 2 });
      shouldBeInvalid(validate, { foo: 4 });
    });
  }

  function validateRangeSchema(schema, parentSchema) {
    var schemaValid = Array.isArray(schema) && schema.length == 2
                      && typeof schema[0] == 'number'
                      && typeof schema[1] == 'number';
    if (!schemaValid) throw new Error('Invalid schema for range keyword, should be array of 2 numbers');

    var exclusiveRangeSchemaValid = parentSchema.exclusiveRange === undefined
                                    || typeof parentSchema.exclusiveRange == 'boolean';
    if (!exclusiveRangeSchemaValid) throw new Error('Invalid schema for exclusiveRange keyword, should be bolean');
  }

  function shouldBeValid(validate, data) {
    validate(data) .should.equal(true);
    should.not.exist(validate.errors);
  }

  function shouldBeInvalid(validate, data, numErrors) {
    validate(data) .should.equal(false);
    validate.errors .should.have.length(numErrors || 1);
  }


  describe('addKeyword method', function() {
    var TEST_TYPES = [ undefined, 'number', 'string', 'boolean', ['number', 'string']];

    it('should throw if defined keyword is passed', function() {
      testThrow(['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength']);
      testThrowDuplicate('custom');

      function testThrow(keywords) {
        TEST_TYPES.forEach(function (dataType, index) {
          should.throw(function(){
            addKeyword(keywords[index], dataType);
          });
        });
      }

      function testThrowDuplicate(keywordPrefix) {
        var index = 0;
        TEST_TYPES.forEach(function (dataType1) {
          TEST_TYPES.forEach(function (dataType2) {
            var keyword = keywordPrefix + (index++);
            addKeyword(keyword, dataType1);
            should.throw(function() {
              addKeyword(keyword, dataType2);
            });
          });
        });
      }
    });

    it('should throw if unknown type is passed', function() {
      should.throw(function() {
        addKeyword('custom1', 'wrongtype');
      });

      should.throw(function() {
        addKeyword('custom2', ['number', 'wrongtype']);
      });

      should.throw(function() {
        addKeyword('custom3', ['number', undefined]);
      });
    });

    it('should throw if type is passed to macro keyword', function() {
      should.throw(function() {
        ajv.addKeyword(keyword, {
          type: 'number',
          macro: function() {}
        });
      });
    });

    function addKeyword(keyword, dataType) {
      ajv.addKeyword(keyword, {
        type: dataType,
        validate: function() {}
      });
    }
  });
});

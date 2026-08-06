/*
 * Display-state loading and selection.
 *
 * Reads the raw configuration from data/display-states.js, merges the shared
 * defaults into each state, and hands the renderer a fully-resolved state
 * object so nothing downstream has to know about defaults.
 *
 * Arrays (notably `columns` and message lists) are replaced wholesale rather
 * than merged, so a state can define its own columns without inheriting
 * fragments of another's.
 */
(function (global) {
  "use strict";

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(base, override) {
    var out = {};
    var key;
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) out[key] = base[key];
    }
    for (key in override) {
      if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
      if (isPlainObject(out[key]) && isPlainObject(override[key])) {
        out[key] = deepMerge(out[key], override[key]);
      } else {
        out[key] = override[key];
      }
    }
    return out;
  }

  function load(raw) {
    var config = raw || global.FIDS_DATA;
    if (!config || !config.displayStates) {
      throw new Error(
        "Display states missing: data/display-states.js did not load",
      );
    }
    var source = config.displayStates;
    var defaults = source.defaults || {};
    var resolved = {};
    var names = [];

    Object.keys(source.states || {}).forEach(function (name) {
      var state = deepMerge(defaults, source.states[name]);
      state.name = name;
      state.columns = (state.columns || []).filter(function (column) {
        return column.enabled !== false;
      });
      resolved[name] = state;
      names.push(name);
    });

    if (!names.length) throw new Error("No display states defined");

    var fallback = resolved[source.defaultState]
      ? source.defaultState
      : names[0];

    return {
      names: names,
      defaultState: fallback,
      /** Returns the named state, or the default if the name is unknown. */
      get: function (name) {
        return resolved[name] || resolved[fallback];
      },
      has: function (name) {
        return !!resolved[name];
      },
      label: function (name) {
        var state = resolved[name];
        return (state && state.label) || name;
      },
    };
  }

  global.FIDS = global.FIDS || {};
  global.FIDS.States = { load: load, deepMerge: deepMerge };
})(window);

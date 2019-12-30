
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
  'use strict';

  function noop() { }
  function assign(tar, src) {
      // @ts-ignore
      for (const k in src)
          tar[k] = src[k];
      return tar;
  }
  function add_location(element, file, line, column, char) {
      element.__svelte_meta = {
          loc: { file, line, column, char }
      };
  }
  function run(fn) {
      return fn();
  }
  function blank_object() {
      return Object.create(null);
  }
  function run_all(fns) {
      fns.forEach(run);
  }
  function is_function(thing) {
      return typeof thing === 'function';
  }
  function safe_not_equal(a, b) {
      return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
  }
  function validate_store(store, name) {
      if (!store || typeof store.subscribe !== 'function') {
          throw new Error(`'${name}' is not a store with a 'subscribe' method`);
      }
  }
  function subscribe(store, callback) {
      const unsub = store.subscribe(callback);
      return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
  }
  function component_subscribe(component, store, callback) {
      component.$$.on_destroy.push(subscribe(store, callback));
  }
  function create_slot(definition, ctx, $$scope, fn) {
      if (definition) {
          const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
          return definition[0](slot_ctx);
      }
  }
  function get_slot_context(definition, ctx, $$scope, fn) {
      return definition[1] && fn
          ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
          : $$scope.ctx;
  }
  function get_slot_changes(definition, $$scope, dirty, fn) {
      if (definition[2] && fn) {
          const lets = definition[2](fn(dirty));
          if (typeof $$scope.dirty === 'object') {
              const merged = [];
              const len = Math.max($$scope.dirty.length, lets.length);
              for (let i = 0; i < len; i += 1) {
                  merged[i] = $$scope.dirty[i] | lets[i];
              }
              return merged;
          }
          return $$scope.dirty | lets;
      }
      return $$scope.dirty;
  }
  function exclude_internal_props(props) {
      const result = {};
      for (const k in props)
          if (k[0] !== '$')
              result[k] = props[k];
      return result;
  }
  function action_destroyer(action_result) {
      return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
  }

  function append(target, node) {
      target.appendChild(node);
  }
  function insert(target, node, anchor) {
      target.insertBefore(node, anchor || null);
  }
  function detach(node) {
      node.parentNode.removeChild(node);
  }
  function element(name) {
      return document.createElement(name);
  }
  function text(data) {
      return document.createTextNode(data);
  }
  function space() {
      return text(' ');
  }
  function empty() {
      return text('');
  }
  function listen(node, event, handler, options) {
      node.addEventListener(event, handler, options);
      return () => node.removeEventListener(event, handler, options);
  }
  function attr(node, attribute, value) {
      if (value == null)
          node.removeAttribute(attribute);
      else if (node.getAttribute(attribute) !== value)
          node.setAttribute(attribute, value);
  }
  function set_attributes(node, attributes) {
      // @ts-ignore
      const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
      for (const key in attributes) {
          if (attributes[key] == null) {
              node.removeAttribute(key);
          }
          else if (key === 'style') {
              node.style.cssText = attributes[key];
          }
          else if (descriptors[key] && descriptors[key].set) {
              node[key] = attributes[key];
          }
          else {
              attr(node, key, attributes[key]);
          }
      }
  }
  function children(element) {
      return Array.from(element.childNodes);
  }
  function custom_event(type, detail) {
      const e = document.createEvent('CustomEvent');
      e.initCustomEvent(type, false, false, detail);
      return e;
  }

  let current_component;
  function set_current_component(component) {
      current_component = component;
  }
  function get_current_component() {
      if (!current_component)
          throw new Error(`Function called outside component initialization`);
      return current_component;
  }
  function onMount(fn) {
      get_current_component().$$.on_mount.push(fn);
  }
  function afterUpdate(fn) {
      get_current_component().$$.after_update.push(fn);
  }
  function onDestroy(fn) {
      get_current_component().$$.on_destroy.push(fn);
  }
  function createEventDispatcher() {
      const component = get_current_component();
      return (type, detail) => {
          const callbacks = component.$$.callbacks[type];
          if (callbacks) {
              // TODO are there situations where events could be dispatched
              // in a server (non-DOM) environment?
              const event = custom_event(type, detail);
              callbacks.slice().forEach(fn => {
                  fn.call(component, event);
              });
          }
      };
  }
  function setContext(key, context) {
      get_current_component().$$.context.set(key, context);
  }
  function getContext(key) {
      return get_current_component().$$.context.get(key);
  }
  // TODO figure out if we still want to support
  // shorthand events, or if we want to implement
  // a real bubbling mechanism
  function bubble(component, event) {
      const callbacks = component.$$.callbacks[event.type];
      if (callbacks) {
          callbacks.slice().forEach(fn => fn(event));
      }
  }

  const dirty_components = [];
  const binding_callbacks = [];
  const render_callbacks = [];
  const flush_callbacks = [];
  const resolved_promise = Promise.resolve();
  let update_scheduled = false;
  function schedule_update() {
      if (!update_scheduled) {
          update_scheduled = true;
          resolved_promise.then(flush);
      }
  }
  function add_render_callback(fn) {
      render_callbacks.push(fn);
  }
  function add_flush_callback(fn) {
      flush_callbacks.push(fn);
  }
  function flush() {
      const seen_callbacks = new Set();
      do {
          // first, call beforeUpdate functions
          // and update components
          while (dirty_components.length) {
              const component = dirty_components.shift();
              set_current_component(component);
              update(component.$$);
          }
          while (binding_callbacks.length)
              binding_callbacks.pop()();
          // then, once components are updated, call
          // afterUpdate functions. This may cause
          // subsequent updates...
          for (let i = 0; i < render_callbacks.length; i += 1) {
              const callback = render_callbacks[i];
              if (!seen_callbacks.has(callback)) {
                  callback();
                  // ...so guard against infinite loops
                  seen_callbacks.add(callback);
              }
          }
          render_callbacks.length = 0;
      } while (dirty_components.length);
      while (flush_callbacks.length) {
          flush_callbacks.pop()();
      }
      update_scheduled = false;
  }
  function update($$) {
      if ($$.fragment !== null) {
          $$.update();
          run_all($$.before_update);
          const dirty = $$.dirty;
          $$.dirty = [-1];
          $$.fragment && $$.fragment.p($$.ctx, dirty);
          $$.after_update.forEach(add_render_callback);
      }
  }
  const outroing = new Set();
  let outros;
  function group_outros() {
      outros = {
          r: 0,
          c: [],
          p: outros // parent group
      };
  }
  function check_outros() {
      if (!outros.r) {
          run_all(outros.c);
      }
      outros = outros.p;
  }
  function transition_in(block, local) {
      if (block && block.i) {
          outroing.delete(block);
          block.i(local);
      }
  }
  function transition_out(block, local, detach, callback) {
      if (block && block.o) {
          if (outroing.has(block))
              return;
          outroing.add(block);
          outros.c.push(() => {
              outroing.delete(block);
              if (callback) {
                  if (detach)
                      block.d(1);
                  callback();
              }
          });
          block.o(local);
      }
  }

  const globals = (typeof window !== 'undefined' ? window : global);

  function get_spread_update(levels, updates) {
      const update = {};
      const to_null_out = {};
      const accounted_for = { $$scope: 1 };
      let i = levels.length;
      while (i--) {
          const o = levels[i];
          const n = updates[i];
          if (n) {
              for (const key in o) {
                  if (!(key in n))
                      to_null_out[key] = 1;
              }
              for (const key in n) {
                  if (!accounted_for[key]) {
                      update[key] = n[key];
                      accounted_for[key] = 1;
                  }
              }
              levels[i] = n;
          }
          else {
              for (const key in o) {
                  accounted_for[key] = 1;
              }
          }
      }
      for (const key in to_null_out) {
          if (!(key in update))
              update[key] = undefined;
      }
      return update;
  }
  function get_spread_object(spread_props) {
      return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
  }

  function bind(component, name, callback) {
      const index = component.$$.props[name];
      if (index !== undefined) {
          component.$$.bound[index] = callback;
          callback(component.$$.ctx[index]);
      }
  }
  function create_component(block) {
      block && block.c();
  }
  function mount_component(component, target, anchor) {
      const { fragment, on_mount, on_destroy, after_update } = component.$$;
      fragment && fragment.m(target, anchor);
      // onMount happens before the initial afterUpdate
      add_render_callback(() => {
          const new_on_destroy = on_mount.map(run).filter(is_function);
          if (on_destroy) {
              on_destroy.push(...new_on_destroy);
          }
          else {
              // Edge case - component was destroyed immediately,
              // most likely as a result of a binding initialising
              run_all(new_on_destroy);
          }
          component.$$.on_mount = [];
      });
      after_update.forEach(add_render_callback);
  }
  function destroy_component(component, detaching) {
      const $$ = component.$$;
      if ($$.fragment !== null) {
          run_all($$.on_destroy);
          $$.fragment && $$.fragment.d(detaching);
          // TODO null out other refs, including component.$$ (but need to
          // preserve final state?)
          $$.on_destroy = $$.fragment = null;
          $$.ctx = [];
      }
  }
  function make_dirty(component, i) {
      if (component.$$.dirty[0] === -1) {
          dirty_components.push(component);
          schedule_update();
          component.$$.dirty.fill(0);
      }
      component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
  }
  function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
      const parent_component = current_component;
      set_current_component(component);
      const prop_values = options.props || {};
      const $$ = component.$$ = {
          fragment: null,
          ctx: null,
          // state
          props,
          update: noop,
          not_equal,
          bound: blank_object(),
          // lifecycle
          on_mount: [],
          on_destroy: [],
          before_update: [],
          after_update: [],
          context: new Map(parent_component ? parent_component.$$.context : []),
          // everything else
          callbacks: blank_object(),
          dirty
      };
      let ready = false;
      $$.ctx = instance
          ? instance(component, prop_values, (i, ret, value = ret) => {
              if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                  if ($$.bound[i])
                      $$.bound[i](value);
                  if (ready)
                      make_dirty(component, i);
              }
              return ret;
          })
          : [];
      $$.update();
      ready = true;
      run_all($$.before_update);
      // `false` as a special case of no DOM component
      $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
      if (options.target) {
          if (options.hydrate) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              $$.fragment && $$.fragment.l(children(options.target));
          }
          else {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              $$.fragment && $$.fragment.c();
          }
          if (options.intro)
              transition_in(component.$$.fragment);
          mount_component(component, options.target, options.anchor);
          flush();
      }
      set_current_component(parent_component);
  }
  class SvelteComponent {
      $destroy() {
          destroy_component(this, 1);
          this.$destroy = noop;
      }
      $on(type, callback) {
          const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
          callbacks.push(callback);
          return () => {
              const index = callbacks.indexOf(callback);
              if (index !== -1)
                  callbacks.splice(index, 1);
          };
      }
      $set() {
          // overridden by instance, if it has props
      }
  }

  function dispatch_dev(type, detail) {
      document.dispatchEvent(custom_event(type, detail));
  }
  function append_dev(target, node) {
      dispatch_dev("SvelteDOMInsert", { target, node });
      append(target, node);
  }
  function insert_dev(target, node, anchor) {
      dispatch_dev("SvelteDOMInsert", { target, node, anchor });
      insert(target, node, anchor);
  }
  function detach_dev(node) {
      dispatch_dev("SvelteDOMRemove", { node });
      detach(node);
  }
  function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
      const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
      if (has_prevent_default)
          modifiers.push('preventDefault');
      if (has_stop_propagation)
          modifiers.push('stopPropagation');
      dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
      const dispose = listen(node, event, handler, options);
      return () => {
          dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
          dispose();
      };
  }
  function attr_dev(node, attribute, value) {
      attr(node, attribute, value);
      if (value == null)
          dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
      else
          dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
  }
  function set_data_dev(text, data) {
      data = '' + data;
      if (text.data === data)
          return;
      dispatch_dev("SvelteDOMSetData", { node: text, data });
      text.data = data;
  }
  class SvelteComponentDev extends SvelteComponent {
      constructor(options) {
          if (!options || (!options.target && !options.$$inline)) {
              throw new Error(`'target' is a required option`);
          }
          super();
      }
      $destroy() {
          super.$destroy();
          this.$destroy = () => {
              console.warn(`Component was already destroyed`); // eslint-disable-line no-console
          };
      }
  }

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */
  /* global Reflect, Promise */

  var extendStatics = function(d, b) {
      extendStatics = Object.setPrototypeOf ||
          ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
          function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
      return extendStatics(d, b);
  };

  function __extends(d, b) {
      extendStatics(d, b);
      function __() { this.constructor = d; }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  }

  var __assign = function() {
      __assign = Object.assign || function __assign(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
      };
      return __assign.apply(this, arguments);
  };

  function __rest(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
          t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
          for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
              if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                  t[p[i]] = s[p[i]];
          }
      return t;
  }

  function __decorate(decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  }

  function __param(paramIndex, decorator) {
      return function (target, key) { decorator(target, key, paramIndex); }
  }

  function __metadata(metadataKey, metadataValue) {
      if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
  }

  function __awaiter(thisArg, _arguments, P, generator) {
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }

  function __generator(thisArg, body) {
      var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
      return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
      function verb(n) { return function (v) { return step([n, v]); }; }
      function step(op) {
          if (f) throw new TypeError("Generator is already executing.");
          while (_) try {
              if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
              if (y = 0, t) op = [op[0] & 2, t.value];
              switch (op[0]) {
                  case 0: case 1: t = op; break;
                  case 4: _.label++; return { value: op[1], done: false };
                  case 5: _.label++; y = op[1]; op = [0]; continue;
                  case 7: op = _.ops.pop(); _.trys.pop(); continue;
                  default:
                      if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                      if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                      if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                      if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                      if (t[2]) _.ops.pop();
                      _.trys.pop(); continue;
              }
              op = body.call(thisArg, _);
          } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
          if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
      }
  }

  function __exportStar(m, exports) {
      for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
  }

  function __values(o) {
      var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
      if (m) return m.call(o);
      return {
          next: function () {
              if (o && i >= o.length) o = void 0;
              return { value: o && o[i++], done: !o };
          }
      };
  }

  function __read(o, n) {
      var m = typeof Symbol === "function" && o[Symbol.iterator];
      if (!m) return o;
      var i = m.call(o), r, ar = [], e;
      try {
          while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
      }
      catch (error) { e = { error: error }; }
      finally {
          try {
              if (r && !r.done && (m = i["return"])) m.call(i);
          }
          finally { if (e) throw e.error; }
      }
      return ar;
  }

  function __spread() {
      for (var ar = [], i = 0; i < arguments.length; i++)
          ar = ar.concat(__read(arguments[i]));
      return ar;
  }

  function __spreadArrays() {
      for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
      for (var r = Array(s), k = 0, i = 0; i < il; i++)
          for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
              r[k] = a[j];
      return r;
  }
  function __await(v) {
      return this instanceof __await ? (this.v = v, this) : new __await(v);
  }

  function __asyncGenerator(thisArg, _arguments, generator) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var g = generator.apply(thisArg, _arguments || []), i, q = [];
      return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
      function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
      function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
      function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
      function fulfill(value) { resume("next", value); }
      function reject(value) { resume("throw", value); }
      function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
  }

  function __asyncDelegator(o) {
      var i, p;
      return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
      function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
  }

  function __asyncValues(o) {
      if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
      var m = o[Symbol.asyncIterator], i;
      return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
      function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
      function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
  }

  function __makeTemplateObject(cooked, raw) {
      if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
      return cooked;
  }
  function __importStar(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
      result.default = mod;
      return result;
  }

  function __importDefault(mod) {
      return (mod && mod.__esModule) ? mod : { default: mod };
  }

  var tslib_es6 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    __extends: __extends,
    get __assign () { return __assign; },
    __rest: __rest,
    __decorate: __decorate,
    __param: __param,
    __metadata: __metadata,
    __awaiter: __awaiter,
    __generator: __generator,
    __exportStar: __exportStar,
    __values: __values,
    __read: __read,
    __spread: __spread,
    __spreadArrays: __spreadArrays,
    __await: __await,
    __asyncGenerator: __asyncGenerator,
    __asyncDelegator: __asyncDelegator,
    __asyncValues: __asyncValues,
    __makeTemplateObject: __makeTemplateObject,
    __importStar: __importStar,
    __importDefault: __importDefault
  });

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCFoundation = /** @class */ (function () {
      function MDCFoundation(adapter) {
          if (adapter === void 0) { adapter = {}; }
          this.adapter_ = adapter;
      }
      Object.defineProperty(MDCFoundation, "cssClasses", {
          get: function () {
              // Classes extending MDCFoundation should implement this method to return an object which exports every
              // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
              return {};
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCFoundation, "strings", {
          get: function () {
              // Classes extending MDCFoundation should implement this method to return an object which exports all
              // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
              return {};
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCFoundation, "numbers", {
          get: function () {
              // Classes extending MDCFoundation should implement this method to return an object which exports all
              // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
              return {};
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCFoundation, "defaultAdapter", {
          get: function () {
              // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
              // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
              // validation.
              return {};
          },
          enumerable: true,
          configurable: true
      });
      MDCFoundation.prototype.init = function () {
          // Subclasses should override this method to perform initialization routines (registering events, etc.)
      };
      MDCFoundation.prototype.destroy = function () {
          // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
      };
      return MDCFoundation;
  }());
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCComponent = /** @class */ (function () {
      function MDCComponent(root, foundation) {
          var args = [];
          for (var _i = 2; _i < arguments.length; _i++) {
              args[_i - 2] = arguments[_i];
          }
          this.root_ = root;
          this.initialize.apply(this, __spread(args));
          // Note that we initialize foundation here and not within the constructor's default param so that
          // this.root_ is defined and can be used within the foundation class.
          this.foundation_ = foundation === undefined ? this.getDefaultFoundation() : foundation;
          this.foundation_.init();
          this.initialSyncWithDOM();
      }
      MDCComponent.attachTo = function (root) {
          // Subclasses which extend MDCBase should provide an attachTo() method that takes a root element and
          // returns an instantiated component with its root set to that element. Also note that in the cases of
          // subclasses, an explicit foundation class will not have to be passed in; it will simply be initialized
          // from getDefaultFoundation().
          return new MDCComponent(root, new MDCFoundation({}));
      };
      /* istanbul ignore next: method param only exists for typing purposes; it does not need to be unit tested */
      MDCComponent.prototype.initialize = function () {
          var _args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              _args[_i] = arguments[_i];
          }
          // Subclasses can override this to do any additional setup work that would be considered part of a
          // "constructor". Essentially, it is a hook into the parent constructor before the foundation is
          // initialized. Any additional arguments besides root and foundation will be passed in here.
      };
      MDCComponent.prototype.getDefaultFoundation = function () {
          // Subclasses must override this method to return a properly configured foundation class for the
          // component.
          throw new Error('Subclasses must override getDefaultFoundation to return a properly configured ' +
              'foundation class');
      };
      MDCComponent.prototype.initialSyncWithDOM = function () {
          // Subclasses should override this method if they need to perform work to synchronize with a host DOM
          // object. An example of this would be a form control wrapper that needs to synchronize its internal state
          // to some property or attribute of the host DOM. Please note: this is *not* the place to perform DOM
          // reads/writes that would cause layout / paint, as this is called synchronously from within the constructor.
      };
      MDCComponent.prototype.destroy = function () {
          // Subclasses may implement this method to release any resources / deregister any listeners they have
          // attached. An example of this might be deregistering a resize event from the window object.
          this.foundation_.destroy();
      };
      MDCComponent.prototype.listen = function (evtType, handler, options) {
          this.root_.addEventListener(evtType, handler, options);
      };
      MDCComponent.prototype.unlisten = function (evtType, handler, options) {
          this.root_.removeEventListener(evtType, handler, options);
      };
      /**
       * Fires a cross-browser-compatible custom event from the component root of the given type, with the given data.
       */
      MDCComponent.prototype.emit = function (evtType, evtData, shouldBubble) {
          if (shouldBubble === void 0) { shouldBubble = false; }
          var evt;
          if (typeof CustomEvent === 'function') {
              evt = new CustomEvent(evtType, {
                  bubbles: shouldBubble,
                  detail: evtData,
              });
          }
          else {
              evt = document.createEvent('CustomEvent');
              evt.initCustomEvent(evtType, shouldBubble, false, evtData);
          }
          this.root_.dispatchEvent(evt);
      };
      return MDCComponent;
  }());
  //# sourceMappingURL=component.js.map

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  /**
   * Stores result from applyPassive to avoid redundant processing to detect
   * passive event listener support.
   */
  var supportsPassive_;
  /**
   * Determine whether the current browser supports passive event listeners, and
   * if so, use them.
   */
  function applyPassive(globalObj, forceRefresh) {
      if (globalObj === void 0) { globalObj = window; }
      if (forceRefresh === void 0) { forceRefresh = false; }
      if (supportsPassive_ === undefined || forceRefresh) {
          var isSupported_1 = false;
          try {
              globalObj.document.addEventListener('test', function () { return undefined; }, {
                  get passive() {
                      isSupported_1 = true;
                      return isSupported_1;
                  },
              });
          }
          catch (e) {
          } // tslint:disable-line:no-empty cannot throw error due to tests. tslint also disables console.log.
          supportsPassive_ = isSupported_1;
      }
      return supportsPassive_ ? { passive: true } : false;
  }
  //# sourceMappingURL=events.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  /**
   * @fileoverview A "ponyfill" is a polyfill that doesn't modify the global prototype chain.
   * This makes ponyfills safer than traditional polyfills, especially for libraries like MDC.
   */
  function closest(element, selector) {
      if (element.closest) {
          return element.closest(selector);
      }
      var el = element;
      while (el) {
          if (matches(el, selector)) {
              return el;
          }
          el = el.parentElement;
      }
      return null;
  }
  function matches(element, selector) {
      var nativeMatches = element.matches
          || element.webkitMatchesSelector
          || element.msMatchesSelector;
      return nativeMatches.call(element, selector);
  }
  //# sourceMappingURL=ponyfill.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses = {
      // Ripple is a special case where the "root" component is really a "mixin" of sorts,
      // given that it's an 'upgrade' to an existing component. That being said it is the root
      // CSS class that all other CSS classes derive from.
      BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
      FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
      FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
      ROOT: 'mdc-ripple-upgraded',
      UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
  };
  var strings = {
      VAR_FG_SCALE: '--mdc-ripple-fg-scale',
      VAR_FG_SIZE: '--mdc-ripple-fg-size',
      VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
      VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
      VAR_LEFT: '--mdc-ripple-left',
      VAR_TOP: '--mdc-ripple-top',
  };
  var numbers = {
      DEACTIVATION_TIMEOUT_MS: 225,
      FG_DEACTIVATION_MS: 150,
      INITIAL_ORIGIN_SCALE: 0.6,
      PADDING: 10,
      TAP_DELAY_MS: 300,
  };
  //# sourceMappingURL=constants.js.map

  /**
   * Stores result from supportsCssVariables to avoid redundant processing to
   * detect CSS custom variable support.
   */
  var supportsCssVariables_;
  function detectEdgePseudoVarBug(windowObj) {
      // Detect versions of Edge with buggy var() support
      // See: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/11495448/
      var document = windowObj.document;
      var node = document.createElement('div');
      node.className = 'mdc-ripple-surface--test-edge-var-bug';
      // Append to head instead of body because this script might be invoked in the
      // head, in which case the body doesn't exist yet. The probe works either way.
      document.head.appendChild(node);
      // The bug exists if ::before style ends up propagating to the parent element.
      // Additionally, getComputedStyle returns null in iframes with display: "none" in Firefox,
      // but Firefox is known to support CSS custom properties correctly.
      // See: https://bugzilla.mozilla.org/show_bug.cgi?id=548397
      var computedStyle = windowObj.getComputedStyle(node);
      var hasPseudoVarBug = computedStyle !== null && computedStyle.borderTopStyle === 'solid';
      if (node.parentNode) {
          node.parentNode.removeChild(node);
      }
      return hasPseudoVarBug;
  }
  function supportsCssVariables(windowObj, forceRefresh) {
      if (forceRefresh === void 0) { forceRefresh = false; }
      var CSS = windowObj.CSS;
      var supportsCssVars = supportsCssVariables_;
      if (typeof supportsCssVariables_ === 'boolean' && !forceRefresh) {
          return supportsCssVariables_;
      }
      var supportsFunctionPresent = CSS && typeof CSS.supports === 'function';
      if (!supportsFunctionPresent) {
          return false;
      }
      var explicitlySupportsCssVars = CSS.supports('--css-vars', 'yes');
      // See: https://bugs.webkit.org/show_bug.cgi?id=154669
      // See: README section on Safari
      var weAreFeatureDetectingSafari10plus = (CSS.supports('(--css-vars: yes)') &&
          CSS.supports('color', '#00000000'));
      if (explicitlySupportsCssVars || weAreFeatureDetectingSafari10plus) {
          supportsCssVars = !detectEdgePseudoVarBug(windowObj);
      }
      else {
          supportsCssVars = false;
      }
      if (!forceRefresh) {
          supportsCssVariables_ = supportsCssVars;
      }
      return supportsCssVars;
  }
  function getNormalizedEventCoords(evt, pageOffset, clientRect) {
      if (!evt) {
          return { x: 0, y: 0 };
      }
      var x = pageOffset.x, y = pageOffset.y;
      var documentX = x + clientRect.left;
      var documentY = y + clientRect.top;
      var normalizedX;
      var normalizedY;
      // Determine touch point relative to the ripple container.
      if (evt.type === 'touchstart') {
          var touchEvent = evt;
          normalizedX = touchEvent.changedTouches[0].pageX - documentX;
          normalizedY = touchEvent.changedTouches[0].pageY - documentY;
      }
      else {
          var mouseEvent = evt;
          normalizedX = mouseEvent.pageX - documentX;
          normalizedY = mouseEvent.pageY - documentY;
      }
      return { x: normalizedX, y: normalizedY };
  }
  //# sourceMappingURL=util.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  // Activation events registered on the root element of each instance for activation
  var ACTIVATION_EVENT_TYPES = [
      'touchstart', 'pointerdown', 'mousedown', 'keydown',
  ];
  // Deactivation events registered on documentElement when a pointer-related down event occurs
  var POINTER_DEACTIVATION_EVENT_TYPES = [
      'touchend', 'pointerup', 'mouseup', 'contextmenu',
  ];
  // simultaneous nested activations
  var activatedTargets = [];
  var MDCRippleFoundation = /** @class */ (function (_super) {
      __extends(MDCRippleFoundation, _super);
      function MDCRippleFoundation(adapter) {
          var _this = _super.call(this, __assign({}, MDCRippleFoundation.defaultAdapter, adapter)) || this;
          _this.activationAnimationHasEnded_ = false;
          _this.activationTimer_ = 0;
          _this.fgDeactivationRemovalTimer_ = 0;
          _this.fgScale_ = '0';
          _this.frame_ = { width: 0, height: 0 };
          _this.initialSize_ = 0;
          _this.layoutFrame_ = 0;
          _this.maxRadius_ = 0;
          _this.unboundedCoords_ = { left: 0, top: 0 };
          _this.activationState_ = _this.defaultActivationState_();
          _this.activationTimerCallback_ = function () {
              _this.activationAnimationHasEnded_ = true;
              _this.runDeactivationUXLogicIfReady_();
          };
          _this.activateHandler_ = function (e) { return _this.activate_(e); };
          _this.deactivateHandler_ = function () { return _this.deactivate_(); };
          _this.focusHandler_ = function () { return _this.handleFocus(); };
          _this.blurHandler_ = function () { return _this.handleBlur(); };
          _this.resizeHandler_ = function () { return _this.layout(); };
          return _this;
      }
      Object.defineProperty(MDCRippleFoundation, "cssClasses", {
          get: function () {
              return cssClasses;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCRippleFoundation, "strings", {
          get: function () {
              return strings;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCRippleFoundation, "numbers", {
          get: function () {
              return numbers;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCRippleFoundation, "defaultAdapter", {
          get: function () {
              return {
                  addClass: function () { return undefined; },
                  browserSupportsCssVars: function () { return true; },
                  computeBoundingRect: function () { return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 }); },
                  containsEventTarget: function () { return true; },
                  deregisterDocumentInteractionHandler: function () { return undefined; },
                  deregisterInteractionHandler: function () { return undefined; },
                  deregisterResizeHandler: function () { return undefined; },
                  getWindowPageOffset: function () { return ({ x: 0, y: 0 }); },
                  isSurfaceActive: function () { return true; },
                  isSurfaceDisabled: function () { return true; },
                  isUnbounded: function () { return true; },
                  registerDocumentInteractionHandler: function () { return undefined; },
                  registerInteractionHandler: function () { return undefined; },
                  registerResizeHandler: function () { return undefined; },
                  removeClass: function () { return undefined; },
                  updateCssVariable: function () { return undefined; },
              };
          },
          enumerable: true,
          configurable: true
      });
      MDCRippleFoundation.prototype.init = function () {
          var _this = this;
          var supportsPressRipple = this.supportsPressRipple_();
          this.registerRootHandlers_(supportsPressRipple);
          if (supportsPressRipple) {
              var _a = MDCRippleFoundation.cssClasses, ROOT_1 = _a.ROOT, UNBOUNDED_1 = _a.UNBOUNDED;
              requestAnimationFrame(function () {
                  _this.adapter_.addClass(ROOT_1);
                  if (_this.adapter_.isUnbounded()) {
                      _this.adapter_.addClass(UNBOUNDED_1);
                      // Unbounded ripples need layout logic applied immediately to set coordinates for both shade and ripple
                      _this.layoutInternal_();
                  }
              });
          }
      };
      MDCRippleFoundation.prototype.destroy = function () {
          var _this = this;
          if (this.supportsPressRipple_()) {
              if (this.activationTimer_) {
                  clearTimeout(this.activationTimer_);
                  this.activationTimer_ = 0;
                  this.adapter_.removeClass(MDCRippleFoundation.cssClasses.FG_ACTIVATION);
              }
              if (this.fgDeactivationRemovalTimer_) {
                  clearTimeout(this.fgDeactivationRemovalTimer_);
                  this.fgDeactivationRemovalTimer_ = 0;
                  this.adapter_.removeClass(MDCRippleFoundation.cssClasses.FG_DEACTIVATION);
              }
              var _a = MDCRippleFoundation.cssClasses, ROOT_2 = _a.ROOT, UNBOUNDED_2 = _a.UNBOUNDED;
              requestAnimationFrame(function () {
                  _this.adapter_.removeClass(ROOT_2);
                  _this.adapter_.removeClass(UNBOUNDED_2);
                  _this.removeCssVars_();
              });
          }
          this.deregisterRootHandlers_();
          this.deregisterDeactivationHandlers_();
      };
      /**
       * @param evt Optional event containing position information.
       */
      MDCRippleFoundation.prototype.activate = function (evt) {
          this.activate_(evt);
      };
      MDCRippleFoundation.prototype.deactivate = function () {
          this.deactivate_();
      };
      MDCRippleFoundation.prototype.layout = function () {
          var _this = this;
          if (this.layoutFrame_) {
              cancelAnimationFrame(this.layoutFrame_);
          }
          this.layoutFrame_ = requestAnimationFrame(function () {
              _this.layoutInternal_();
              _this.layoutFrame_ = 0;
          });
      };
      MDCRippleFoundation.prototype.setUnbounded = function (unbounded) {
          var UNBOUNDED = MDCRippleFoundation.cssClasses.UNBOUNDED;
          if (unbounded) {
              this.adapter_.addClass(UNBOUNDED);
          }
          else {
              this.adapter_.removeClass(UNBOUNDED);
          }
      };
      MDCRippleFoundation.prototype.handleFocus = function () {
          var _this = this;
          requestAnimationFrame(function () {
              return _this.adapter_.addClass(MDCRippleFoundation.cssClasses.BG_FOCUSED);
          });
      };
      MDCRippleFoundation.prototype.handleBlur = function () {
          var _this = this;
          requestAnimationFrame(function () {
              return _this.adapter_.removeClass(MDCRippleFoundation.cssClasses.BG_FOCUSED);
          });
      };
      /**
       * We compute this property so that we are not querying information about the client
       * until the point in time where the foundation requests it. This prevents scenarios where
       * client-side feature-detection may happen too early, such as when components are rendered on the server
       * and then initialized at mount time on the client.
       */
      MDCRippleFoundation.prototype.supportsPressRipple_ = function () {
          return this.adapter_.browserSupportsCssVars();
      };
      MDCRippleFoundation.prototype.defaultActivationState_ = function () {
          return {
              activationEvent: undefined,
              hasDeactivationUXRun: false,
              isActivated: false,
              isProgrammatic: false,
              wasActivatedByPointer: false,
              wasElementMadeActive: false,
          };
      };
      /**
       * supportsPressRipple Passed from init to save a redundant function call
       */
      MDCRippleFoundation.prototype.registerRootHandlers_ = function (supportsPressRipple) {
          var _this = this;
          if (supportsPressRipple) {
              ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                  _this.adapter_.registerInteractionHandler(evtType, _this.activateHandler_);
              });
              if (this.adapter_.isUnbounded()) {
                  this.adapter_.registerResizeHandler(this.resizeHandler_);
              }
          }
          this.adapter_.registerInteractionHandler('focus', this.focusHandler_);
          this.adapter_.registerInteractionHandler('blur', this.blurHandler_);
      };
      MDCRippleFoundation.prototype.registerDeactivationHandlers_ = function (evt) {
          var _this = this;
          if (evt.type === 'keydown') {
              this.adapter_.registerInteractionHandler('keyup', this.deactivateHandler_);
          }
          else {
              POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
                  _this.adapter_.registerDocumentInteractionHandler(evtType, _this.deactivateHandler_);
              });
          }
      };
      MDCRippleFoundation.prototype.deregisterRootHandlers_ = function () {
          var _this = this;
          ACTIVATION_EVENT_TYPES.forEach(function (evtType) {
              _this.adapter_.deregisterInteractionHandler(evtType, _this.activateHandler_);
          });
          this.adapter_.deregisterInteractionHandler('focus', this.focusHandler_);
          this.adapter_.deregisterInteractionHandler('blur', this.blurHandler_);
          if (this.adapter_.isUnbounded()) {
              this.adapter_.deregisterResizeHandler(this.resizeHandler_);
          }
      };
      MDCRippleFoundation.prototype.deregisterDeactivationHandlers_ = function () {
          var _this = this;
          this.adapter_.deregisterInteractionHandler('keyup', this.deactivateHandler_);
          POINTER_DEACTIVATION_EVENT_TYPES.forEach(function (evtType) {
              _this.adapter_.deregisterDocumentInteractionHandler(evtType, _this.deactivateHandler_);
          });
      };
      MDCRippleFoundation.prototype.removeCssVars_ = function () {
          var _this = this;
          var rippleStrings = MDCRippleFoundation.strings;
          var keys = Object.keys(rippleStrings);
          keys.forEach(function (key) {
              if (key.indexOf('VAR_') === 0) {
                  _this.adapter_.updateCssVariable(rippleStrings[key], null);
              }
          });
      };
      MDCRippleFoundation.prototype.activate_ = function (evt) {
          var _this = this;
          if (this.adapter_.isSurfaceDisabled()) {
              return;
          }
          var activationState = this.activationState_;
          if (activationState.isActivated) {
              return;
          }
          // Avoid reacting to follow-on events fired by touch device after an already-processed user interaction
          var previousActivationEvent = this.previousActivationEvent_;
          var isSameInteraction = previousActivationEvent && evt !== undefined && previousActivationEvent.type !== evt.type;
          if (isSameInteraction) {
              return;
          }
          activationState.isActivated = true;
          activationState.isProgrammatic = evt === undefined;
          activationState.activationEvent = evt;
          activationState.wasActivatedByPointer = activationState.isProgrammatic ? false : evt !== undefined && (evt.type === 'mousedown' || evt.type === 'touchstart' || evt.type === 'pointerdown');
          var hasActivatedChild = evt !== undefined && activatedTargets.length > 0 && activatedTargets.some(function (target) { return _this.adapter_.containsEventTarget(target); });
          if (hasActivatedChild) {
              // Immediately reset activation state, while preserving logic that prevents touch follow-on events
              this.resetActivationState_();
              return;
          }
          if (evt !== undefined) {
              activatedTargets.push(evt.target);
              this.registerDeactivationHandlers_(evt);
          }
          activationState.wasElementMadeActive = this.checkElementMadeActive_(evt);
          if (activationState.wasElementMadeActive) {
              this.animateActivation_();
          }
          requestAnimationFrame(function () {
              // Reset array on next frame after the current event has had a chance to bubble to prevent ancestor ripples
              activatedTargets = [];
              if (!activationState.wasElementMadeActive
                  && evt !== undefined
                  && (evt.key === ' ' || evt.keyCode === 32)) {
                  // If space was pressed, try again within an rAF call to detect :active, because different UAs report
                  // active states inconsistently when they're called within event handling code:
                  // - https://bugs.chromium.org/p/chromium/issues/detail?id=635971
                  // - https://bugzilla.mozilla.org/show_bug.cgi?id=1293741
                  // We try first outside rAF to support Edge, which does not exhibit this problem, but will crash if a CSS
                  // variable is set within a rAF callback for a submit button interaction (#2241).
                  activationState.wasElementMadeActive = _this.checkElementMadeActive_(evt);
                  if (activationState.wasElementMadeActive) {
                      _this.animateActivation_();
                  }
              }
              if (!activationState.wasElementMadeActive) {
                  // Reset activation state immediately if element was not made active.
                  _this.activationState_ = _this.defaultActivationState_();
              }
          });
      };
      MDCRippleFoundation.prototype.checkElementMadeActive_ = function (evt) {
          return (evt !== undefined && evt.type === 'keydown') ? this.adapter_.isSurfaceActive() : true;
      };
      MDCRippleFoundation.prototype.animateActivation_ = function () {
          var _this = this;
          var _a = MDCRippleFoundation.strings, VAR_FG_TRANSLATE_START = _a.VAR_FG_TRANSLATE_START, VAR_FG_TRANSLATE_END = _a.VAR_FG_TRANSLATE_END;
          var _b = MDCRippleFoundation.cssClasses, FG_DEACTIVATION = _b.FG_DEACTIVATION, FG_ACTIVATION = _b.FG_ACTIVATION;
          var DEACTIVATION_TIMEOUT_MS = MDCRippleFoundation.numbers.DEACTIVATION_TIMEOUT_MS;
          this.layoutInternal_();
          var translateStart = '';
          var translateEnd = '';
          if (!this.adapter_.isUnbounded()) {
              var _c = this.getFgTranslationCoordinates_(), startPoint = _c.startPoint, endPoint = _c.endPoint;
              translateStart = startPoint.x + "px, " + startPoint.y + "px";
              translateEnd = endPoint.x + "px, " + endPoint.y + "px";
          }
          this.adapter_.updateCssVariable(VAR_FG_TRANSLATE_START, translateStart);
          this.adapter_.updateCssVariable(VAR_FG_TRANSLATE_END, translateEnd);
          // Cancel any ongoing activation/deactivation animations
          clearTimeout(this.activationTimer_);
          clearTimeout(this.fgDeactivationRemovalTimer_);
          this.rmBoundedActivationClasses_();
          this.adapter_.removeClass(FG_DEACTIVATION);
          // Force layout in order to re-trigger the animation.
          this.adapter_.computeBoundingRect();
          this.adapter_.addClass(FG_ACTIVATION);
          this.activationTimer_ = setTimeout(function () { return _this.activationTimerCallback_(); }, DEACTIVATION_TIMEOUT_MS);
      };
      MDCRippleFoundation.prototype.getFgTranslationCoordinates_ = function () {
          var _a = this.activationState_, activationEvent = _a.activationEvent, wasActivatedByPointer = _a.wasActivatedByPointer;
          var startPoint;
          if (wasActivatedByPointer) {
              startPoint = getNormalizedEventCoords(activationEvent, this.adapter_.getWindowPageOffset(), this.adapter_.computeBoundingRect());
          }
          else {
              startPoint = {
                  x: this.frame_.width / 2,
                  y: this.frame_.height / 2,
              };
          }
          // Center the element around the start point.
          startPoint = {
              x: startPoint.x - (this.initialSize_ / 2),
              y: startPoint.y - (this.initialSize_ / 2),
          };
          var endPoint = {
              x: (this.frame_.width / 2) - (this.initialSize_ / 2),
              y: (this.frame_.height / 2) - (this.initialSize_ / 2),
          };
          return { startPoint: startPoint, endPoint: endPoint };
      };
      MDCRippleFoundation.prototype.runDeactivationUXLogicIfReady_ = function () {
          var _this = this;
          // This method is called both when a pointing device is released, and when the activation animation ends.
          // The deactivation animation should only run after both of those occur.
          var FG_DEACTIVATION = MDCRippleFoundation.cssClasses.FG_DEACTIVATION;
          var _a = this.activationState_, hasDeactivationUXRun = _a.hasDeactivationUXRun, isActivated = _a.isActivated;
          var activationHasEnded = hasDeactivationUXRun || !isActivated;
          if (activationHasEnded && this.activationAnimationHasEnded_) {
              this.rmBoundedActivationClasses_();
              this.adapter_.addClass(FG_DEACTIVATION);
              this.fgDeactivationRemovalTimer_ = setTimeout(function () {
                  _this.adapter_.removeClass(FG_DEACTIVATION);
              }, numbers.FG_DEACTIVATION_MS);
          }
      };
      MDCRippleFoundation.prototype.rmBoundedActivationClasses_ = function () {
          var FG_ACTIVATION = MDCRippleFoundation.cssClasses.FG_ACTIVATION;
          this.adapter_.removeClass(FG_ACTIVATION);
          this.activationAnimationHasEnded_ = false;
          this.adapter_.computeBoundingRect();
      };
      MDCRippleFoundation.prototype.resetActivationState_ = function () {
          var _this = this;
          this.previousActivationEvent_ = this.activationState_.activationEvent;
          this.activationState_ = this.defaultActivationState_();
          // Touch devices may fire additional events for the same interaction within a short time.
          // Store the previous event until it's safe to assume that subsequent events are for new interactions.
          setTimeout(function () { return _this.previousActivationEvent_ = undefined; }, MDCRippleFoundation.numbers.TAP_DELAY_MS);
      };
      MDCRippleFoundation.prototype.deactivate_ = function () {
          var _this = this;
          var activationState = this.activationState_;
          // This can happen in scenarios such as when you have a keyup event that blurs the element.
          if (!activationState.isActivated) {
              return;
          }
          var state = __assign({}, activationState);
          if (activationState.isProgrammatic) {
              requestAnimationFrame(function () { return _this.animateDeactivation_(state); });
              this.resetActivationState_();
          }
          else {
              this.deregisterDeactivationHandlers_();
              requestAnimationFrame(function () {
                  _this.activationState_.hasDeactivationUXRun = true;
                  _this.animateDeactivation_(state);
                  _this.resetActivationState_();
              });
          }
      };
      MDCRippleFoundation.prototype.animateDeactivation_ = function (_a) {
          var wasActivatedByPointer = _a.wasActivatedByPointer, wasElementMadeActive = _a.wasElementMadeActive;
          if (wasActivatedByPointer || wasElementMadeActive) {
              this.runDeactivationUXLogicIfReady_();
          }
      };
      MDCRippleFoundation.prototype.layoutInternal_ = function () {
          var _this = this;
          this.frame_ = this.adapter_.computeBoundingRect();
          var maxDim = Math.max(this.frame_.height, this.frame_.width);
          // Surface diameter is treated differently for unbounded vs. bounded ripples.
          // Unbounded ripple diameter is calculated smaller since the surface is expected to already be padded appropriately
          // to extend the hitbox, and the ripple is expected to meet the edges of the padded hitbox (which is typically
          // square). Bounded ripples, on the other hand, are fully expected to expand beyond the surface's longest diameter
          // (calculated based on the diagonal plus a constant padding), and are clipped at the surface's border via
          // `overflow: hidden`.
          var getBoundedRadius = function () {
              var hypotenuse = Math.sqrt(Math.pow(_this.frame_.width, 2) + Math.pow(_this.frame_.height, 2));
              return hypotenuse + MDCRippleFoundation.numbers.PADDING;
          };
          this.maxRadius_ = this.adapter_.isUnbounded() ? maxDim : getBoundedRadius();
          // Ripple is sized as a fraction of the largest dimension of the surface, then scales up using a CSS scale transform
          this.initialSize_ = Math.floor(maxDim * MDCRippleFoundation.numbers.INITIAL_ORIGIN_SCALE);
          this.fgScale_ = "" + this.maxRadius_ / this.initialSize_;
          this.updateLayoutCssVars_();
      };
      MDCRippleFoundation.prototype.updateLayoutCssVars_ = function () {
          var _a = MDCRippleFoundation.strings, VAR_FG_SIZE = _a.VAR_FG_SIZE, VAR_LEFT = _a.VAR_LEFT, VAR_TOP = _a.VAR_TOP, VAR_FG_SCALE = _a.VAR_FG_SCALE;
          this.adapter_.updateCssVariable(VAR_FG_SIZE, this.initialSize_ + "px");
          this.adapter_.updateCssVariable(VAR_FG_SCALE, this.fgScale_);
          if (this.adapter_.isUnbounded()) {
              this.unboundedCoords_ = {
                  left: Math.round((this.frame_.width / 2) - (this.initialSize_ / 2)),
                  top: Math.round((this.frame_.height / 2) - (this.initialSize_ / 2)),
              };
              this.adapter_.updateCssVariable(VAR_LEFT, this.unboundedCoords_.left + "px");
              this.adapter_.updateCssVariable(VAR_TOP, this.unboundedCoords_.top + "px");
          }
      };
      return MDCRippleFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCRipple = /** @class */ (function (_super) {
      __extends(MDCRipple, _super);
      function MDCRipple() {
          var _this = _super !== null && _super.apply(this, arguments) || this;
          _this.disabled = false;
          return _this;
      }
      MDCRipple.attachTo = function (root, opts) {
          if (opts === void 0) { opts = { isUnbounded: undefined }; }
          var ripple = new MDCRipple(root);
          // Only override unbounded behavior if option is explicitly specified
          if (opts.isUnbounded !== undefined) {
              ripple.unbounded = opts.isUnbounded;
          }
          return ripple;
      };
      MDCRipple.createAdapter = function (instance) {
          return {
              addClass: function (className) { return instance.root_.classList.add(className); },
              browserSupportsCssVars: function () { return supportsCssVariables(window); },
              computeBoundingRect: function () { return instance.root_.getBoundingClientRect(); },
              containsEventTarget: function (target) { return instance.root_.contains(target); },
              deregisterDocumentInteractionHandler: function (evtType, handler) {
                  return document.documentElement.removeEventListener(evtType, handler, applyPassive());
              },
              deregisterInteractionHandler: function (evtType, handler) {
                  return instance.root_.removeEventListener(evtType, handler, applyPassive());
              },
              deregisterResizeHandler: function (handler) { return window.removeEventListener('resize', handler); },
              getWindowPageOffset: function () { return ({ x: window.pageXOffset, y: window.pageYOffset }); },
              isSurfaceActive: function () { return matches(instance.root_, ':active'); },
              isSurfaceDisabled: function () { return Boolean(instance.disabled); },
              isUnbounded: function () { return Boolean(instance.unbounded); },
              registerDocumentInteractionHandler: function (evtType, handler) {
                  return document.documentElement.addEventListener(evtType, handler, applyPassive());
              },
              registerInteractionHandler: function (evtType, handler) {
                  return instance.root_.addEventListener(evtType, handler, applyPassive());
              },
              registerResizeHandler: function (handler) { return window.addEventListener('resize', handler); },
              removeClass: function (className) { return instance.root_.classList.remove(className); },
              updateCssVariable: function (varName, value) { return instance.root_.style.setProperty(varName, value); },
          };
      };
      Object.defineProperty(MDCRipple.prototype, "unbounded", {
          get: function () {
              return Boolean(this.unbounded_);
          },
          set: function (unbounded) {
              this.unbounded_ = Boolean(unbounded);
              this.setUnbounded_();
          },
          enumerable: true,
          configurable: true
      });
      MDCRipple.prototype.activate = function () {
          this.foundation_.activate();
      };
      MDCRipple.prototype.deactivate = function () {
          this.foundation_.deactivate();
      };
      MDCRipple.prototype.layout = function () {
          this.foundation_.layout();
      };
      MDCRipple.prototype.getDefaultFoundation = function () {
          return new MDCRippleFoundation(MDCRipple.createAdapter(this));
      };
      MDCRipple.prototype.initialSyncWithDOM = function () {
          var root = this.root_;
          this.unbounded = 'mdcRippleIsUnbounded' in root.dataset;
      };
      /**
       * Closure Compiler throws an access control error when directly accessing a
       * protected or private property inside a getter/setter, like unbounded above.
       * By accessing the protected property inside a method, we solve that problem.
       * That's why this function exists.
       */
      MDCRipple.prototype.setUnbounded_ = function () {
          this.foundation_.setUnbounded(Boolean(this.unbounded_));
      };
      return MDCRipple;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$1 = {
      FIXED_CLASS: 'mdc-top-app-bar--fixed',
      FIXED_SCROLLED_CLASS: 'mdc-top-app-bar--fixed-scrolled',
      SHORT_CLASS: 'mdc-top-app-bar--short',
      SHORT_COLLAPSED_CLASS: 'mdc-top-app-bar--short-collapsed',
      SHORT_HAS_ACTION_ITEM_CLASS: 'mdc-top-app-bar--short-has-action-item',
  };
  var numbers$1 = {
      DEBOUNCE_THROTTLE_RESIZE_TIME_MS: 100,
      MAX_TOP_APP_BAR_HEIGHT: 128,
  };
  var strings$1 = {
      ACTION_ITEM_SELECTOR: '.mdc-top-app-bar__action-item',
      NAVIGATION_EVENT: 'MDCTopAppBar:nav',
      NAVIGATION_ICON_SELECTOR: '.mdc-top-app-bar__navigation-icon',
      ROOT_SELECTOR: '.mdc-top-app-bar',
      TITLE_SELECTOR: '.mdc-top-app-bar__title',
  };
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCTopAppBarBaseFoundation = /** @class */ (function (_super) {
      __extends(MDCTopAppBarBaseFoundation, _super);
      /* istanbul ignore next: optional argument is not a branch statement */
      function MDCTopAppBarBaseFoundation(adapter) {
          return _super.call(this, __assign({}, MDCTopAppBarBaseFoundation.defaultAdapter, adapter)) || this;
      }
      Object.defineProperty(MDCTopAppBarBaseFoundation, "strings", {
          get: function () {
              return strings$1;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCTopAppBarBaseFoundation, "cssClasses", {
          get: function () {
              return cssClasses$1;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCTopAppBarBaseFoundation, "numbers", {
          get: function () {
              return numbers$1;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCTopAppBarBaseFoundation, "defaultAdapter", {
          /**
           * See {@link MDCTopAppBarAdapter} for typing information on parameters and return types.
           */
          get: function () {
              // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
              return {
                  addClass: function () { return undefined; },
                  removeClass: function () { return undefined; },
                  hasClass: function () { return false; },
                  setStyle: function () { return undefined; },
                  getTopAppBarHeight: function () { return 0; },
                  notifyNavigationIconClicked: function () { return undefined; },
                  getViewportScrollY: function () { return 0; },
                  getTotalActionItems: function () { return 0; },
              };
              // tslint:enable:object-literal-sort-keys
          },
          enumerable: true,
          configurable: true
      });
      /** Other variants of TopAppBar foundation overrides this method */
      MDCTopAppBarBaseFoundation.prototype.handleTargetScroll = function () { }; // tslint:disable-line:no-empty
      /** Other variants of TopAppBar foundation overrides this method */
      MDCTopAppBarBaseFoundation.prototype.handleWindowResize = function () { }; // tslint:disable-line:no-empty
      MDCTopAppBarBaseFoundation.prototype.handleNavigationClick = function () {
          this.adapter_.notifyNavigationIconClicked();
      };
      return MDCTopAppBarBaseFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var INITIAL_VALUE = 0;
  var MDCTopAppBarFoundation = /** @class */ (function (_super) {
      __extends(MDCTopAppBarFoundation, _super);
      /* istanbul ignore next: optional argument is not a branch statement */
      function MDCTopAppBarFoundation(adapter) {
          var _this = _super.call(this, adapter) || this;
          /**
           * Indicates if the top app bar was docked in the previous scroll handler iteration.
           */
          _this.wasDocked_ = true;
          /**
           * Indicates if the top app bar is docked in the fully shown position.
           */
          _this.isDockedShowing_ = true;
          /**
           * Variable for current scroll position of the top app bar
           */
          _this.currentAppBarOffsetTop_ = 0;
          /**
           * Used to prevent the top app bar from being scrolled out of view during resize events
           */
          _this.isCurrentlyBeingResized_ = false;
          /**
           * The timeout that's used to throttle the resize events
           */
          _this.resizeThrottleId_ = INITIAL_VALUE;
          /**
           * The timeout that's used to debounce toggling the isCurrentlyBeingResized_ variable after a resize
           */
          _this.resizeDebounceId_ = INITIAL_VALUE;
          _this.lastScrollPosition_ = _this.adapter_.getViewportScrollY();
          _this.topAppBarHeight_ = _this.adapter_.getTopAppBarHeight();
          return _this;
      }
      MDCTopAppBarFoundation.prototype.destroy = function () {
          _super.prototype.destroy.call(this);
          this.adapter_.setStyle('top', '');
      };
      /**
       * Scroll handler for the default scroll behavior of the top app bar.
       * @override
       */
      MDCTopAppBarFoundation.prototype.handleTargetScroll = function () {
          var currentScrollPosition = Math.max(this.adapter_.getViewportScrollY(), 0);
          var diff = currentScrollPosition - this.lastScrollPosition_;
          this.lastScrollPosition_ = currentScrollPosition;
          // If the window is being resized the lastScrollPosition_ needs to be updated but the
          // current scroll of the top app bar should stay in the same position.
          if (!this.isCurrentlyBeingResized_) {
              this.currentAppBarOffsetTop_ -= diff;
              if (this.currentAppBarOffsetTop_ > 0) {
                  this.currentAppBarOffsetTop_ = 0;
              }
              else if (Math.abs(this.currentAppBarOffsetTop_) > this.topAppBarHeight_) {
                  this.currentAppBarOffsetTop_ = -this.topAppBarHeight_;
              }
              this.moveTopAppBar_();
          }
      };
      /**
       * Top app bar resize handler that throttle/debounce functions that execute updates.
       * @override
       */
      MDCTopAppBarFoundation.prototype.handleWindowResize = function () {
          var _this = this;
          // Throttle resize events 10 p/s
          if (!this.resizeThrottleId_) {
              this.resizeThrottleId_ = setTimeout(function () {
                  _this.resizeThrottleId_ = INITIAL_VALUE;
                  _this.throttledResizeHandler_();
              }, numbers$1.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
          }
          this.isCurrentlyBeingResized_ = true;
          if (this.resizeDebounceId_) {
              clearTimeout(this.resizeDebounceId_);
          }
          this.resizeDebounceId_ = setTimeout(function () {
              _this.handleTargetScroll();
              _this.isCurrentlyBeingResized_ = false;
              _this.resizeDebounceId_ = INITIAL_VALUE;
          }, numbers$1.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
      };
      /**
       * Function to determine if the DOM needs to update.
       */
      MDCTopAppBarFoundation.prototype.checkForUpdate_ = function () {
          var offscreenBoundaryTop = -this.topAppBarHeight_;
          var hasAnyPixelsOffscreen = this.currentAppBarOffsetTop_ < 0;
          var hasAnyPixelsOnscreen = this.currentAppBarOffsetTop_ > offscreenBoundaryTop;
          var partiallyShowing = hasAnyPixelsOffscreen && hasAnyPixelsOnscreen;
          // If it's partially showing, it can't be docked.
          if (partiallyShowing) {
              this.wasDocked_ = false;
          }
          else {
              // Not previously docked and not partially showing, it's now docked.
              if (!this.wasDocked_) {
                  this.wasDocked_ = true;
                  return true;
              }
              else if (this.isDockedShowing_ !== hasAnyPixelsOnscreen) {
                  this.isDockedShowing_ = hasAnyPixelsOnscreen;
                  return true;
              }
          }
          return partiallyShowing;
      };
      /**
       * Function to move the top app bar if needed.
       */
      MDCTopAppBarFoundation.prototype.moveTopAppBar_ = function () {
          if (this.checkForUpdate_()) {
              // Once the top app bar is fully hidden we use the max potential top app bar height as our offset
              // so the top app bar doesn't show if the window resizes and the new height > the old height.
              var offset = this.currentAppBarOffsetTop_;
              if (Math.abs(offset) >= this.topAppBarHeight_) {
                  offset = -numbers$1.MAX_TOP_APP_BAR_HEIGHT;
              }
              this.adapter_.setStyle('top', offset + 'px');
          }
      };
      /**
       * Throttled function that updates the top app bar scrolled values if the
       * top app bar height changes.
       */
      MDCTopAppBarFoundation.prototype.throttledResizeHandler_ = function () {
          var currentHeight = this.adapter_.getTopAppBarHeight();
          if (this.topAppBarHeight_ !== currentHeight) {
              this.wasDocked_ = false;
              // Since the top app bar has a different height depending on the screen width, this
              // will ensure that the top app bar remains in the correct location if
              // completely hidden and a resize makes the top app bar a different height.
              this.currentAppBarOffsetTop_ -= this.topAppBarHeight_ - currentHeight;
              this.topAppBarHeight_ = currentHeight;
          }
          this.handleTargetScroll();
      };
      return MDCTopAppBarFoundation;
  }(MDCTopAppBarBaseFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCFixedTopAppBarFoundation = /** @class */ (function (_super) {
      __extends(MDCFixedTopAppBarFoundation, _super);
      function MDCFixedTopAppBarFoundation() {
          var _this = _super !== null && _super.apply(this, arguments) || this;
          /**
           * State variable for the previous scroll iteration top app bar state
           */
          _this.wasScrolled_ = false;
          return _this;
      }
      /**
       * Scroll handler for applying/removing the modifier class on the fixed top app bar.
       * @override
       */
      MDCFixedTopAppBarFoundation.prototype.handleTargetScroll = function () {
          var currentScroll = this.adapter_.getViewportScrollY();
          if (currentScroll <= 0) {
              if (this.wasScrolled_) {
                  this.adapter_.removeClass(cssClasses$1.FIXED_SCROLLED_CLASS);
                  this.wasScrolled_ = false;
              }
          }
          else {
              if (!this.wasScrolled_) {
                  this.adapter_.addClass(cssClasses$1.FIXED_SCROLLED_CLASS);
                  this.wasScrolled_ = true;
              }
          }
      };
      return MDCFixedTopAppBarFoundation;
  }(MDCTopAppBarFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCShortTopAppBarFoundation = /** @class */ (function (_super) {
      __extends(MDCShortTopAppBarFoundation, _super);
      /* istanbul ignore next: optional argument is not a branch statement */
      function MDCShortTopAppBarFoundation(adapter) {
          var _this = _super.call(this, adapter) || this;
          _this.isCollapsed_ = false;
          _this.isAlwaysCollapsed_ = false;
          return _this;
      }
      Object.defineProperty(MDCShortTopAppBarFoundation.prototype, "isCollapsed", {
          // Public visibility for backward compatibility.
          get: function () {
              return this.isCollapsed_;
          },
          enumerable: true,
          configurable: true
      });
      MDCShortTopAppBarFoundation.prototype.init = function () {
          _super.prototype.init.call(this);
          if (this.adapter_.getTotalActionItems() > 0) {
              this.adapter_.addClass(cssClasses$1.SHORT_HAS_ACTION_ITEM_CLASS);
          }
          // If initialized with SHORT_COLLAPSED_CLASS, the bar should always be collapsed
          this.setAlwaysCollapsed(this.adapter_.hasClass(cssClasses$1.SHORT_COLLAPSED_CLASS));
      };
      /**
       * Set if the short top app bar should always be collapsed.
       *
       * @param value When `true`, bar will always be collapsed. When `false`, bar may collapse or expand based on scroll.
       */
      MDCShortTopAppBarFoundation.prototype.setAlwaysCollapsed = function (value) {
          this.isAlwaysCollapsed_ = !!value;
          if (this.isAlwaysCollapsed_) {
              this.collapse_();
          }
          else {
              // let maybeCollapseBar_ determine if the bar should be collapsed
              this.maybeCollapseBar_();
          }
      };
      MDCShortTopAppBarFoundation.prototype.getAlwaysCollapsed = function () {
          return this.isAlwaysCollapsed_;
      };
      /**
       * Scroll handler for applying/removing the collapsed modifier class on the short top app bar.
       * @override
       */
      MDCShortTopAppBarFoundation.prototype.handleTargetScroll = function () {
          this.maybeCollapseBar_();
      };
      MDCShortTopAppBarFoundation.prototype.maybeCollapseBar_ = function () {
          if (this.isAlwaysCollapsed_) {
              return;
          }
          var currentScroll = this.adapter_.getViewportScrollY();
          if (currentScroll <= 0) {
              if (this.isCollapsed_) {
                  this.uncollapse_();
              }
          }
          else {
              if (!this.isCollapsed_) {
                  this.collapse_();
              }
          }
      };
      MDCShortTopAppBarFoundation.prototype.uncollapse_ = function () {
          this.adapter_.removeClass(cssClasses$1.SHORT_COLLAPSED_CLASS);
          this.isCollapsed_ = false;
      };
      MDCShortTopAppBarFoundation.prototype.collapse_ = function () {
          this.adapter_.addClass(cssClasses$1.SHORT_COLLAPSED_CLASS);
          this.isCollapsed_ = true;
      };
      return MDCShortTopAppBarFoundation;
  }(MDCTopAppBarBaseFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCTopAppBar = /** @class */ (function (_super) {
      __extends(MDCTopAppBar, _super);
      function MDCTopAppBar() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      MDCTopAppBar.attachTo = function (root) {
          return new MDCTopAppBar(root);
      };
      MDCTopAppBar.prototype.initialize = function (rippleFactory) {
          if (rippleFactory === void 0) { rippleFactory = function (el) { return MDCRipple.attachTo(el); }; }
          this.navIcon_ = this.root_.querySelector(strings$1.NAVIGATION_ICON_SELECTOR);
          // Get all icons in the toolbar and instantiate the ripples
          var icons = [].slice.call(this.root_.querySelectorAll(strings$1.ACTION_ITEM_SELECTOR));
          if (this.navIcon_) {
              icons.push(this.navIcon_);
          }
          this.iconRipples_ = icons.map(function (icon) {
              var ripple = rippleFactory(icon);
              ripple.unbounded = true;
              return ripple;
          });
          this.scrollTarget_ = window;
      };
      MDCTopAppBar.prototype.initialSyncWithDOM = function () {
          this.handleNavigationClick_ = this.foundation_.handleNavigationClick.bind(this.foundation_);
          this.handleWindowResize_ = this.foundation_.handleWindowResize.bind(this.foundation_);
          this.handleTargetScroll_ = this.foundation_.handleTargetScroll.bind(this.foundation_);
          this.scrollTarget_.addEventListener('scroll', this.handleTargetScroll_);
          if (this.navIcon_) {
              this.navIcon_.addEventListener('click', this.handleNavigationClick_);
          }
          var isFixed = this.root_.classList.contains(cssClasses$1.FIXED_CLASS);
          var isShort = this.root_.classList.contains(cssClasses$1.SHORT_CLASS);
          if (!isShort && !isFixed) {
              window.addEventListener('resize', this.handleWindowResize_);
          }
      };
      MDCTopAppBar.prototype.destroy = function () {
          this.iconRipples_.forEach(function (iconRipple) { return iconRipple.destroy(); });
          this.scrollTarget_.removeEventListener('scroll', this.handleTargetScroll_);
          if (this.navIcon_) {
              this.navIcon_.removeEventListener('click', this.handleNavigationClick_);
          }
          var isFixed = this.root_.classList.contains(cssClasses$1.FIXED_CLASS);
          var isShort = this.root_.classList.contains(cssClasses$1.SHORT_CLASS);
          if (!isShort && !isFixed) {
              window.removeEventListener('resize', this.handleWindowResize_);
          }
          _super.prototype.destroy.call(this);
      };
      MDCTopAppBar.prototype.setScrollTarget = function (target) {
          // Remove scroll handler from the previous scroll target
          this.scrollTarget_.removeEventListener('scroll', this.handleTargetScroll_);
          this.scrollTarget_ = target;
          // Initialize scroll handler on the new scroll target
          this.handleTargetScroll_ =
              this.foundation_.handleTargetScroll.bind(this.foundation_);
          this.scrollTarget_.addEventListener('scroll', this.handleTargetScroll_);
      };
      MDCTopAppBar.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
          var adapter = {
              hasClass: function (className) { return _this.root_.classList.contains(className); },
              addClass: function (className) { return _this.root_.classList.add(className); },
              removeClass: function (className) { return _this.root_.classList.remove(className); },
              setStyle: function (property, value) { return _this.root_.style.setProperty(property, value); },
              getTopAppBarHeight: function () { return _this.root_.clientHeight; },
              notifyNavigationIconClicked: function () { return _this.emit(strings$1.NAVIGATION_EVENT, {}); },
              getViewportScrollY: function () {
                  var win = _this.scrollTarget_;
                  var el = _this.scrollTarget_;
                  return win.pageYOffset !== undefined ? win.pageYOffset : el.scrollTop;
              },
              getTotalActionItems: function () { return _this.root_.querySelectorAll(strings$1.ACTION_ITEM_SELECTOR).length; },
          };
          // tslint:enable:object-literal-sort-keys
          var foundation;
          if (this.root_.classList.contains(cssClasses$1.SHORT_CLASS)) {
              foundation = new MDCShortTopAppBarFoundation(adapter);
          }
          else if (this.root_.classList.contains(cssClasses$1.FIXED_CLASS)) {
              foundation = new MDCFixedTopAppBarFoundation(adapter);
          }
          else {
              foundation = new MDCTopAppBarFoundation(adapter);
          }
          return foundation;
      };
      return MDCTopAppBar;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  function forwardEventsBuilder(component, additionalEvents = []) {
    const events = [
      'focus', 'blur',
      'fullscreenchange', 'fullscreenerror', 'scroll',
      'cut', 'copy', 'paste',
      'keydown', 'keypress', 'keyup',
      'auxclick', 'click', 'contextmenu', 'dblclick', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove', 'mouseover', 'mouseout', 'mouseup', 'pointerlockchange', 'pointerlockerror', 'select', 'wheel',
      'drag', 'dragend', 'dragenter', 'dragstart', 'dragleave', 'dragover', 'drop',
      'touchcancel', 'touchend', 'touchmove', 'touchstart',
      'pointerover', 'pointerenter', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerout', 'pointerleave', 'gotpointercapture', 'lostpointercapture',
      ...additionalEvents
    ];

    function forward(e) {
      bubble(component, e);
    }

    return node => {
      const destructors = [];

      for (let i = 0; i < events.length; i++) {
        destructors.push(listen(node, events[i], forward));
      }

      return {
        destroy: () => {
          for (let i = 0; i < destructors.length; i++) {
            destructors[i]();
          }
        }
      }
    };
  }

  function exclude(obj, keys) {
    let names = Object.getOwnPropertyNames(obj);
    const newObj = {};

    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const cashIndex = name.indexOf('$');
      if (cashIndex !== -1 && keys.indexOf(name.substring(0, cashIndex + 1)) !== -1) {
        continue;
      }
      if (keys.indexOf(name) !== -1) {
        continue;
      }
      newObj[name] = obj[name];
    }

    return newObj;
  }

  function useActions(node, actions) {
    let objects = [];

    if (actions) {
      for (let i = 0; i < actions.length; i++) {
        const isArray = Array.isArray(actions[i]);
        const action = isArray ? actions[i][0] : actions[i];
        if (isArray && actions[i].length > 1) {
          objects.push(action(node, actions[i][1]));
        } else {
          objects.push(action(node));
        }
      }
    }

    return {
      update(actions) {
        if ((actions && actions.length || 0) != objects.length) {
          throw new Error('You must not change the length of an actions array.');
        }

        if (actions) {
          for (let i = 0; i < actions.length; i++) {
            if (objects[i] && 'update' in objects[i]) {
              const isArray = Array.isArray(actions[i]);
              if (isArray && actions[i].length > 1) {
                objects[i].update(actions[i][1]);
              } else {
                objects[i].update();
              }
            }
          }
        }
      },

      destroy() {
        for (let i = 0; i < objects.length; i++) {
          if (objects[i] && 'destroy' in objects[i]) {
            objects[i].destroy();
          }
        }
      }
    }
  }

  /* node_modules/@smui/top-app-bar/TopAppBar.svelte generated by Svelte v3.16.7 */
  const file = "node_modules/@smui/top-app-bar/TopAppBar.svelte";

  function create_fragment(ctx) {
  	let header;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[12].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[11], null);

  	let header_levels = [
  		{
  			class: "\n    mdc-top-app-bar\n    " + /*className*/ ctx[1] + "\n    " + (/*variant*/ ctx[2] === "short"
  			? "mdc-top-app-bar--short"
  			: "") + "\n    " + (/*collapsed*/ ctx[4]
  			? "mdc-top-app-bar--short-collapsed"
  			: "") + "\n    " + (/*variant*/ ctx[2] === "fixed"
  			? "mdc-top-app-bar--fixed"
  			: "") + "\n    " + (/*variant*/ ctx[2] === "static"
  			? "smui-top-app-bar--static"
  			: "") + "\n    " + (/*color*/ ctx[3] === "secondary"
  			? "smui-top-app-bar--color-secondary"
  			: "") + "\n    " + (/*prominent*/ ctx[5] ? "mdc-top-app-bar--prominent" : "") + "\n    " + (/*dense*/ ctx[6] ? "mdc-top-app-bar--dense" : "") + "\n  "
  		},
  		exclude(/*$$props*/ ctx[9], ["use", "class", "variant", "color", "collapsed", "prominent", "dense"])
  	];

  	let header_data = {};

  	for (let i = 0; i < header_levels.length; i += 1) {
  		header_data = assign(header_data, header_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			header = element("header");
  			if (default_slot) default_slot.c();
  			set_attributes(header, header_data);
  			add_location(header, file, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, header, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[8].call(null, header))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, header, anchor);

  			if (default_slot) {
  				default_slot.m(header, null);
  			}

  			/*header_binding*/ ctx[13](header);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 2048) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[11], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[11], dirty, null));
  			}

  			set_attributes(header, get_spread_update(header_levels, [
  				dirty & /*className, variant, collapsed, color, prominent, dense*/ 126 && ({
  					class: "\n    mdc-top-app-bar\n    " + /*className*/ ctx[1] + "\n    " + (/*variant*/ ctx[2] === "short"
  					? "mdc-top-app-bar--short"
  					: "") + "\n    " + (/*collapsed*/ ctx[4]
  					? "mdc-top-app-bar--short-collapsed"
  					: "") + "\n    " + (/*variant*/ ctx[2] === "fixed"
  					? "mdc-top-app-bar--fixed"
  					: "") + "\n    " + (/*variant*/ ctx[2] === "static"
  					? "smui-top-app-bar--static"
  					: "") + "\n    " + (/*color*/ ctx[3] === "secondary"
  					? "smui-top-app-bar--color-secondary"
  					: "") + "\n    " + (/*prominent*/ ctx[5] ? "mdc-top-app-bar--prominent" : "") + "\n    " + (/*dense*/ ctx[6] ? "mdc-top-app-bar--dense" : "") + "\n  "
  				}),
  				dirty & /*exclude, $$props*/ 512 && exclude(/*$$props*/ ctx[9], ["use", "class", "variant", "color", "collapsed", "prominent", "dense"])
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(header);
  			if (default_slot) default_slot.d(detaching);
  			/*header_binding*/ ctx[13](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { variant = "standard" } = $$props;
  	let { color = "primary" } = $$props;
  	let { collapsed = false } = $$props;
  	let { prominent = false } = $$props;
  	let { dense = false } = $$props;
  	let element;
  	let topAppBar;

  	onMount(() => {
  		topAppBar = new MDCTopAppBar(element);
  	});

  	onDestroy(() => {
  		topAppBar && topAppBar.destroy();
  	});

  	let { $$slots = {}, $$scope } = $$props;

  	function header_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(7, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(9, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("variant" in $$new_props) $$invalidate(2, variant = $$new_props.variant);
  		if ("color" in $$new_props) $$invalidate(3, color = $$new_props.color);
  		if ("collapsed" in $$new_props) $$invalidate(4, collapsed = $$new_props.collapsed);
  		if ("prominent" in $$new_props) $$invalidate(5, prominent = $$new_props.prominent);
  		if ("dense" in $$new_props) $$invalidate(6, dense = $$new_props.dense);
  		if ("$$scope" in $$new_props) $$invalidate(11, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			variant,
  			color,
  			collapsed,
  			prominent,
  			dense,
  			element,
  			topAppBar
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(9, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("variant" in $$props) $$invalidate(2, variant = $$new_props.variant);
  		if ("color" in $$props) $$invalidate(3, color = $$new_props.color);
  		if ("collapsed" in $$props) $$invalidate(4, collapsed = $$new_props.collapsed);
  		if ("prominent" in $$props) $$invalidate(5, prominent = $$new_props.prominent);
  		if ("dense" in $$props) $$invalidate(6, dense = $$new_props.dense);
  		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
  		if ("topAppBar" in $$props) topAppBar = $$new_props.topAppBar;
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		variant,
  		color,
  		collapsed,
  		prominent,
  		dense,
  		element,
  		forwardEvents,
  		$$props,
  		topAppBar,
  		$$scope,
  		$$slots,
  		header_binding
  	];
  }

  class TopAppBar extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance, create_fragment, safe_not_equal, {
  			use: 0,
  			class: 1,
  			variant: 2,
  			color: 3,
  			collapsed: 4,
  			prominent: 5,
  			dense: 6
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "TopAppBar",
  			options,
  			id: create_fragment.name
  		});
  	}

  	get use() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get variant() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set variant(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get color() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set color(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get collapsed() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set collapsed(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get prominent() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set prominent(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get dense() {
  		throw new Error("<TopAppBar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set dense(value) {
  		throw new Error("<TopAppBar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* node_modules/@smui/common/ClassAdder.svelte generated by Svelte v3.16.7 */

  // (1:0) <svelte:component   this={component}   use={[forwardEvents, ...use]}   class="{smuiClass} {className}"   {...exclude($$props, ['use', 'class', 'component', 'forwardEvents'])} >
  function create_default_slot(ctx) {
  	let current;
  	const default_slot_template = /*$$slots*/ ctx[8].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

  	const block = {
  		c: function create() {
  			if (default_slot) default_slot.c();
  		},
  		m: function mount(target, anchor) {
  			if (default_slot) {
  				default_slot.m(target, anchor);
  			}

  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 512) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[9], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null));
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (default_slot) default_slot.d(detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot.name,
  		type: "slot",
  		source: "(1:0) <svelte:component   this={component}   use={[forwardEvents, ...use]}   class=\\\"{smuiClass} {className}\\\"   {...exclude($$props, ['use', 'class', 'component', 'forwardEvents'])} >",
  		ctx
  	});

  	return block;
  }

  function create_fragment$1(ctx) {
  	let switch_instance_anchor;
  	let current;

  	const switch_instance_spread_levels = [
  		{
  			use: [/*forwardEvents*/ ctx[4], .../*use*/ ctx[0]]
  		},
  		{
  			class: "" + (/*smuiClass*/ ctx[3] + " " + /*className*/ ctx[1])
  		},
  		exclude(/*$$props*/ ctx[5], ["use", "class", "component", "forwardEvents"])
  	];

  	var switch_value = /*component*/ ctx[2];

  	function switch_props(ctx) {
  		let switch_instance_props = {
  			$$slots: { default: [create_default_slot] },
  			$$scope: { ctx }
  		};

  		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
  			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
  		}

  		return {
  			props: switch_instance_props,
  			$$inline: true
  		};
  	}

  	if (switch_value) {
  		var switch_instance = new switch_value(switch_props(ctx));
  	}

  	const block = {
  		c: function create() {
  			if (switch_instance) create_component(switch_instance.$$.fragment);
  			switch_instance_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if (switch_instance) {
  				mount_component(switch_instance, target, anchor);
  			}

  			insert_dev(target, switch_instance_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			const switch_instance_changes = (dirty & /*forwardEvents, use, smuiClass, className, exclude, $$props*/ 59)
  			? get_spread_update(switch_instance_spread_levels, [
  					dirty & /*forwardEvents, use*/ 17 && ({
  						use: [/*forwardEvents*/ ctx[4], .../*use*/ ctx[0]]
  					}),
  					dirty & /*smuiClass, className*/ 10 && ({
  						class: "" + (/*smuiClass*/ ctx[3] + " " + /*className*/ ctx[1])
  					}),
  					dirty & /*exclude, $$props*/ 32 && get_spread_object(exclude(/*$$props*/ ctx[5], ["use", "class", "component", "forwardEvents"]))
  				])
  			: {};

  			if (dirty & /*$$scope*/ 512) {
  				switch_instance_changes.$$scope = { dirty, ctx };
  			}

  			if (switch_value !== (switch_value = /*component*/ ctx[2])) {
  				if (switch_instance) {
  					group_outros();
  					const old_component = switch_instance;

  					transition_out(old_component.$$.fragment, 1, 0, () => {
  						destroy_component(old_component, 1);
  					});

  					check_outros();
  				}

  				if (switch_value) {
  					switch_instance = new switch_value(switch_props(ctx));
  					create_component(switch_instance.$$.fragment);
  					transition_in(switch_instance.$$.fragment, 1);
  					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
  				} else {
  					switch_instance = null;
  				}
  			} else if (switch_value) {
  				switch_instance.$set(switch_instance_changes);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(switch_instance_anchor);
  			if (switch_instance) destroy_component(switch_instance, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$1.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  const internals = {
  	component: null,
  	smuiClass: null,
  	contexts: {}
  };

  function instance$1($$self, $$props, $$invalidate) {
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { component = internals.component } = $$props;
  	let { forwardEvents: smuiForwardEvents = [] } = $$props;
  	const smuiClass = internals.class;
  	const contexts = internals.contexts;
  	const forwardEvents = forwardEventsBuilder(current_component, smuiForwardEvents);

  	for (let context in contexts) {
  		if (contexts.hasOwnProperty(context)) {
  			setContext(context, contexts[context]);
  		}
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("component" in $$new_props) $$invalidate(2, component = $$new_props.component);
  		if ("forwardEvents" in $$new_props) $$invalidate(6, smuiForwardEvents = $$new_props.forwardEvents);
  		if ("$$scope" in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			component,
  			smuiForwardEvents
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("component" in $$props) $$invalidate(2, component = $$new_props.component);
  		if ("smuiForwardEvents" in $$props) $$invalidate(6, smuiForwardEvents = $$new_props.smuiForwardEvents);
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		component,
  		smuiClass,
  		forwardEvents,
  		$$props,
  		smuiForwardEvents,
  		contexts,
  		$$slots,
  		$$scope
  	];
  }

  class ClassAdder extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
  			use: 0,
  			class: 1,
  			component: 2,
  			forwardEvents: 6
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "ClassAdder",
  			options,
  			id: create_fragment$1.name
  		});
  	}

  	get use() {
  		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get component() {
  		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set component(value) {
  		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get forwardEvents() {
  		throw new Error("<ClassAdder>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set forwardEvents(value) {
  		throw new Error("<ClassAdder>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  function classAdderBuilder(props) {
    function Component(...args) {
      Object.assign(internals, props);
      return new ClassAdder(...args);
    }

    Component.prototype = ClassAdder;

    // SSR support
    if (ClassAdder.$$render) {
      Component.$$render = (...args) => Object.assign(internals, props) && ClassAdder.$$render(...args);
    }
    if (ClassAdder.render) {
      Component.render = (...args) => Object.assign(internals, props) && ClassAdder.render(...args);
    }

    return Component;
  }

  /* node_modules/@smui/common/Div.svelte generated by Svelte v3.16.7 */
  const file$1 = "node_modules/@smui/common/Div.svelte";

  function create_fragment$2(ctx) {
  	let div;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[4].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
  	let div_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
  	let div_data = {};

  	for (let i = 0; i < div_levels.length; i += 1) {
  		div_data = assign(div_data, div_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			div = element("div");
  			if (default_slot) default_slot.c();
  			set_attributes(div, div_data);
  			add_location(div, file$1, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, div))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			if (default_slot) {
  				default_slot.m(div, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
  			}

  			set_attributes(div, get_spread_update(div_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$2.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$2($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, forwardEvents, $$props, $$scope, $$slots];
  }

  class Div extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$2, create_fragment$2, safe_not_equal, { use: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Div",
  			options,
  			id: create_fragment$2.name
  		});
  	}

  	get use() {
  		throw new Error("<Div>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Div>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var Row = classAdderBuilder({
    class: 'mdc-top-app-bar__row',
    component: Div,
    contexts: {}
  });

  /* node_modules/@smui/top-app-bar/Section.svelte generated by Svelte v3.16.7 */
  const file$2 = "node_modules/@smui/top-app-bar/Section.svelte";

  function create_fragment$3(ctx) {
  	let section;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[7].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[6], null);

  	let section_levels = [
  		{
  			class: "\n    mdc-top-app-bar__section\n    " + /*className*/ ctx[1] + "\n    " + (/*align*/ ctx[2] === "start"
  			? "mdc-top-app-bar__section--align-start"
  			: "") + "\n    " + (/*align*/ ctx[2] === "end"
  			? "mdc-top-app-bar__section--align-end"
  			: "") + "\n  "
  		},
  		/*toolbar*/ ctx[3] ? { role: "toolbar" } : {},
  		exclude(/*$$props*/ ctx[5], ["use", "class", "align", "toolbar"])
  	];

  	let section_data = {};

  	for (let i = 0; i < section_levels.length; i += 1) {
  		section_data = assign(section_data, section_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			section = element("section");
  			if (default_slot) default_slot.c();
  			set_attributes(section, section_data);
  			add_location(section, file$2, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, section, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[4].call(null, section))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, section, anchor);

  			if (default_slot) {
  				default_slot.m(section, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 64) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[6], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[6], dirty, null));
  			}

  			set_attributes(section, get_spread_update(section_levels, [
  				dirty & /*className, align*/ 6 && ({
  					class: "\n    mdc-top-app-bar__section\n    " + /*className*/ ctx[1] + "\n    " + (/*align*/ ctx[2] === "start"
  					? "mdc-top-app-bar__section--align-start"
  					: "") + "\n    " + (/*align*/ ctx[2] === "end"
  					? "mdc-top-app-bar__section--align-end"
  					: "") + "\n  "
  				}),
  				dirty & /*toolbar*/ 8 && (/*toolbar*/ ctx[3] ? { role: "toolbar" } : {}),
  				dirty & /*exclude, $$props*/ 32 && exclude(/*$$props*/ ctx[5], ["use", "class", "align", "toolbar"])
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(section);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$3.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$3($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { align = "start" } = $$props;
  	let { toolbar = false } = $$props;

  	setContext("SMUI:icon-button:context", toolbar
  	? "top-app-bar:action"
  	: "top-app-bar:navigation");

  	setContext("SMUI:button:context", toolbar
  	? "top-app-bar:action"
  	: "top-app-bar:navigation");

  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("align" in $$new_props) $$invalidate(2, align = $$new_props.align);
  		if ("toolbar" in $$new_props) $$invalidate(3, toolbar = $$new_props.toolbar);
  		if ("$$scope" in $$new_props) $$invalidate(6, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use, className, align, toolbar };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("align" in $$props) $$invalidate(2, align = $$new_props.align);
  		if ("toolbar" in $$props) $$invalidate(3, toolbar = $$new_props.toolbar);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, className, align, toolbar, forwardEvents, $$props, $$scope, $$slots];
  }

  class Section extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$3, create_fragment$3, safe_not_equal, { use: 0, class: 1, align: 2, toolbar: 3 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Section",
  			options,
  			id: create_fragment$3.name
  		});
  	}

  	get use() {
  		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get align() {
  		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set align(value) {
  		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get toolbar() {
  		throw new Error("<Section>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set toolbar(value) {
  		throw new Error("<Section>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* node_modules/@smui/common/Span.svelte generated by Svelte v3.16.7 */
  const file$3 = "node_modules/@smui/common/Span.svelte";

  function create_fragment$4(ctx) {
  	let span;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[4].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
  	let span_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
  	let span_data = {};

  	for (let i = 0; i < span_levels.length; i += 1) {
  		span_data = assign(span_data, span_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			span = element("span");
  			if (default_slot) default_slot.c();
  			set_attributes(span, span_data);
  			add_location(span, file$3, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, span, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, span))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, span, anchor);

  			if (default_slot) {
  				default_slot.m(span, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
  			}

  			set_attributes(span, get_spread_update(span_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(span);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$4.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$4($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, forwardEvents, $$props, $$scope, $$slots];
  }

  class Span extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$4, create_fragment$4, safe_not_equal, { use: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Span",
  			options,
  			id: create_fragment$4.name
  		});
  	}

  	get use() {
  		throw new Error("<Span>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Span>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var Title = classAdderBuilder({
    class: 'mdc-top-app-bar__title',
    component: Span,
    contexts: {}
  });

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$2 = {
      ICON_BUTTON_ON: 'mdc-icon-button--on',
      ROOT: 'mdc-icon-button',
  };
  var strings$2 = {
      ARIA_PRESSED: 'aria-pressed',
      CHANGE_EVENT: 'MDCIconButtonToggle:change',
  };
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCIconButtonToggleFoundation = /** @class */ (function (_super) {
      __extends(MDCIconButtonToggleFoundation, _super);
      function MDCIconButtonToggleFoundation(adapter) {
          return _super.call(this, __assign({}, MDCIconButtonToggleFoundation.defaultAdapter, adapter)) || this;
      }
      Object.defineProperty(MDCIconButtonToggleFoundation, "cssClasses", {
          get: function () {
              return cssClasses$2;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCIconButtonToggleFoundation, "strings", {
          get: function () {
              return strings$2;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCIconButtonToggleFoundation, "defaultAdapter", {
          get: function () {
              return {
                  addClass: function () { return undefined; },
                  hasClass: function () { return false; },
                  notifyChange: function () { return undefined; },
                  removeClass: function () { return undefined; },
                  setAttr: function () { return undefined; },
              };
          },
          enumerable: true,
          configurable: true
      });
      MDCIconButtonToggleFoundation.prototype.init = function () {
          this.adapter_.setAttr(strings$2.ARIA_PRESSED, "" + this.isOn());
      };
      MDCIconButtonToggleFoundation.prototype.handleClick = function () {
          this.toggle();
          this.adapter_.notifyChange({ isOn: this.isOn() });
      };
      MDCIconButtonToggleFoundation.prototype.isOn = function () {
          return this.adapter_.hasClass(cssClasses$2.ICON_BUTTON_ON);
      };
      MDCIconButtonToggleFoundation.prototype.toggle = function (isOn) {
          if (isOn === void 0) { isOn = !this.isOn(); }
          if (isOn) {
              this.adapter_.addClass(cssClasses$2.ICON_BUTTON_ON);
          }
          else {
              this.adapter_.removeClass(cssClasses$2.ICON_BUTTON_ON);
          }
          this.adapter_.setAttr(strings$2.ARIA_PRESSED, "" + isOn);
      };
      return MDCIconButtonToggleFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var strings$3 = MDCIconButtonToggleFoundation.strings;
  var MDCIconButtonToggle = /** @class */ (function (_super) {
      __extends(MDCIconButtonToggle, _super);
      function MDCIconButtonToggle() {
          var _this = _super !== null && _super.apply(this, arguments) || this;
          _this.ripple_ = _this.createRipple_();
          return _this;
      }
      MDCIconButtonToggle.attachTo = function (root) {
          return new MDCIconButtonToggle(root);
      };
      MDCIconButtonToggle.prototype.initialSyncWithDOM = function () {
          var _this = this;
          this.handleClick_ = function () { return _this.foundation_.handleClick(); };
          this.listen('click', this.handleClick_);
      };
      MDCIconButtonToggle.prototype.destroy = function () {
          this.unlisten('click', this.handleClick_);
          this.ripple_.destroy();
          _super.prototype.destroy.call(this);
      };
      MDCIconButtonToggle.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          var adapter = {
              addClass: function (className) { return _this.root_.classList.add(className); },
              hasClass: function (className) { return _this.root_.classList.contains(className); },
              notifyChange: function (evtData) { return _this.emit(strings$3.CHANGE_EVENT, evtData); },
              removeClass: function (className) { return _this.root_.classList.remove(className); },
              setAttr: function (attrName, attrValue) { return _this.root_.setAttribute(attrName, attrValue); },
          };
          return new MDCIconButtonToggleFoundation(adapter);
      };
      Object.defineProperty(MDCIconButtonToggle.prototype, "ripple", {
          get: function () {
              return this.ripple_;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCIconButtonToggle.prototype, "on", {
          get: function () {
              return this.foundation_.isOn();
          },
          set: function (isOn) {
              this.foundation_.toggle(isOn);
          },
          enumerable: true,
          configurable: true
      });
      MDCIconButtonToggle.prototype.createRipple_ = function () {
          var ripple = new MDCRipple(this.root_);
          ripple.unbounded = true;
          return ripple;
      };
      return MDCIconButtonToggle;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  function Ripple(node, [ripple, props = {unbounded: false, color: null}]) {
    let instance = null;
    let addLayoutListener = getContext('SMUI:addLayoutListener');
    let removeLayoutListener;

    function handleProps(ripple, props) {
      if (ripple && !instance) {
        instance = new MDCRipple(node);
      } else if (instance && !ripple) {
        instance.destroy();
        instance = null;
      }
      if (ripple) {
        instance.unbounded = !!props.unbounded;
        switch (props.color) {
          case 'surface':
            node.classList.add('mdc-ripple-surface');
            node.classList.remove('mdc-ripple-surface--primary');
            node.classList.remove('mdc-ripple-surface--accent');
            return;
          case 'primary':
            node.classList.add('mdc-ripple-surface');
            node.classList.add('mdc-ripple-surface--primary');
            node.classList.remove('mdc-ripple-surface--accent');
            return;
          case 'secondary':
            node.classList.add('mdc-ripple-surface');
            node.classList.remove('mdc-ripple-surface--primary');
            node.classList.add('mdc-ripple-surface--accent');
            return;
        }
      }
      node.classList.remove('mdc-ripple-surface');
      node.classList.remove('mdc-ripple-surface--primary');
      node.classList.remove('mdc-ripple-surface--accent');
    }

    if (ripple) {
      handleProps(ripple, props);
    }

    if (addLayoutListener) {
      removeLayoutListener = addLayoutListener(layout);
    }

    function layout() {
      if (instance) {
        instance.layout();
      }
    }

    return {
      update([ripple, props = {unbounded: false, color: null}]) {
        handleProps(ripple, props);
      },

      destroy() {
        if (instance) {
          instance.destroy();
          instance = null;
          node.classList.remove('mdc-ripple-surface');
          node.classList.remove('mdc-ripple-surface--primary');
          node.classList.remove('mdc-ripple-surface--accent');
        }

        if (removeLayoutListener) {
          removeLayoutListener();
        }
      }
    }
  }

  /* node_modules/@smui/icon-button/IconButton.svelte generated by Svelte v3.16.7 */
  const file$4 = "node_modules/@smui/icon-button/IconButton.svelte";

  // (23:0) {:else}
  function create_else_block(ctx) {
  	let button;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[16].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

  	let button_levels = [
  		{
  			class: "\n      mdc-icon-button\n      " + /*className*/ ctx[2] + "\n      " + (/*pressed*/ ctx[0] ? "mdc-icon-button--on" : "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  			? "mdc-card__action"
  			: "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  			? "mdc-card__action--icon"
  			: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:navigation"
  			? "mdc-top-app-bar__navigation-icon"
  			: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:action"
  			? "mdc-top-app-bar__action-item"
  			: "") + "\n      " + (/*context*/ ctx[10] === "snackbar"
  			? "mdc-snackbar__dismiss"
  			: "") + "\n    "
  		},
  		{ "aria-hidden": "true" },
  		{ "aria-pressed": /*pressed*/ ctx[0] },
  		/*props*/ ctx[8]
  	];

  	let button_data = {};

  	for (let i = 0; i < button_levels.length; i += 1) {
  		button_data = assign(button_data, button_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			button = element("button");
  			if (default_slot) default_slot.c();
  			set_attributes(button, button_data);
  			add_location(button, file$4, 23, 2, 763);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, button, /*use*/ ctx[1])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[9].call(null, button)),
  				action_destroyer(Ripple_action = Ripple.call(null, button, [
  					/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
  					{ unbounded: true, color: /*color*/ ctx[4] }
  				])),
  				listen_dev(button, "MDCIconButtonToggle:change", /*handleChange*/ ctx[11], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, button, anchor);

  			if (default_slot) {
  				default_slot.m(button, null);
  			}

  			/*button_binding*/ ctx[18](button);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
  			}

  			set_attributes(button, get_spread_update(button_levels, [
  				dirty & /*className, pressed, context*/ 1029 && ({
  					class: "\n      mdc-icon-button\n      " + /*className*/ ctx[2] + "\n      " + (/*pressed*/ ctx[0] ? "mdc-icon-button--on" : "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  					? "mdc-card__action"
  					: "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  					? "mdc-card__action--icon"
  					: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:navigation"
  					? "mdc-top-app-bar__navigation-icon"
  					: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:action"
  					? "mdc-top-app-bar__action-item"
  					: "") + "\n      " + (/*context*/ ctx[10] === "snackbar"
  					? "mdc-snackbar__dismiss"
  					: "") + "\n    "
  				}),
  				{ "aria-hidden": "true" },
  				dirty & /*pressed*/ 1 && ({ "aria-pressed": /*pressed*/ ctx[0] }),
  				dirty & /*props*/ 256 && /*props*/ ctx[8]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple, toggle, color*/ 56) Ripple_action.update.call(null, [
  				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
  				{ unbounded: true, color: /*color*/ ctx[4] }
  			]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(button);
  			if (default_slot) default_slot.d(detaching);
  			/*button_binding*/ ctx[18](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block.name,
  		type: "else",
  		source: "(23:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (1:0) {#if href}
  function create_if_block(ctx) {
  	let a;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[16].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

  	let a_levels = [
  		{
  			class: "\n      mdc-icon-button\n      " + /*className*/ ctx[2] + "\n      " + (/*pressed*/ ctx[0] ? "mdc-icon-button--on" : "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  			? "mdc-card__action"
  			: "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  			? "mdc-card__action--icon"
  			: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:navigation"
  			? "mdc-top-app-bar__navigation-icon"
  			: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:action"
  			? "mdc-top-app-bar__action-item"
  			: "") + "\n      " + (/*context*/ ctx[10] === "snackbar"
  			? "mdc-snackbar__dismiss"
  			: "") + "\n    "
  		},
  		{ "aria-hidden": "true" },
  		{ "aria-pressed": /*pressed*/ ctx[0] },
  		{ href: /*href*/ ctx[6] },
  		/*props*/ ctx[8]
  	];

  	let a_data = {};

  	for (let i = 0; i < a_levels.length; i += 1) {
  		a_data = assign(a_data, a_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			a = element("a");
  			if (default_slot) default_slot.c();
  			set_attributes(a, a_data);
  			add_location(a, file$4, 1, 2, 13);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, a, /*use*/ ctx[1])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[9].call(null, a)),
  				action_destroyer(Ripple_action = Ripple.call(null, a, [
  					/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
  					{ unbounded: true, color: /*color*/ ctx[4] }
  				])),
  				listen_dev(a, "MDCIconButtonToggle:change", /*handleChange*/ ctx[11], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, a, anchor);

  			if (default_slot) {
  				default_slot.m(a, null);
  			}

  			/*a_binding*/ ctx[17](a);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32768) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[15], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null));
  			}

  			set_attributes(a, get_spread_update(a_levels, [
  				dirty & /*className, pressed, context*/ 1029 && ({
  					class: "\n      mdc-icon-button\n      " + /*className*/ ctx[2] + "\n      " + (/*pressed*/ ctx[0] ? "mdc-icon-button--on" : "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  					? "mdc-card__action"
  					: "") + "\n      " + (/*context*/ ctx[10] === "card:action"
  					? "mdc-card__action--icon"
  					: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:navigation"
  					? "mdc-top-app-bar__navigation-icon"
  					: "") + "\n      " + (/*context*/ ctx[10] === "top-app-bar:action"
  					? "mdc-top-app-bar__action-item"
  					: "") + "\n      " + (/*context*/ ctx[10] === "snackbar"
  					? "mdc-snackbar__dismiss"
  					: "") + "\n    "
  				}),
  				{ "aria-hidden": "true" },
  				dirty & /*pressed*/ 1 && ({ "aria-pressed": /*pressed*/ ctx[0] }),
  				dirty & /*href*/ 64 && ({ href: /*href*/ ctx[6] }),
  				dirty & /*props*/ 256 && /*props*/ ctx[8]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple, toggle, color*/ 56) Ripple_action.update.call(null, [
  				/*ripple*/ ctx[3] && !/*toggle*/ ctx[5],
  				{ unbounded: true, color: /*color*/ ctx[4] }
  			]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(a);
  			if (default_slot) default_slot.d(detaching);
  			/*a_binding*/ ctx[17](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block.name,
  		type: "if",
  		source: "(1:0) {#if href}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$5(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block, create_else_block];
  	const if_blocks = [];

  	function select_block_type(ctx, dirty) {
  		if (/*href*/ ctx[6]) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(ctx, dirty);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$5.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$5($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCIconButtonToggle:change"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { ripple = true } = $$props;
  	let { color = null } = $$props;
  	let { toggle = false } = $$props;
  	let { pressed = false } = $$props;
  	let { href = null } = $$props;
  	let element;
  	let toggleButton;
  	let context = getContext("SMUI:icon-button:context");
  	setContext("SMUI:icon:context", "icon-button");
  	let oldToggle = null;

  	onDestroy(() => {
  		toggleButton && toggleButton.destroy();
  	});

  	function handleChange(e) {
  		$$invalidate(0, pressed = e.detail.isOn);
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function a_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(7, element = $$value);
  		});
  	}

  	function button_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(7, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(14, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(1, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
  		if ("ripple" in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
  		if ("color" in $$new_props) $$invalidate(4, color = $$new_props.color);
  		if ("toggle" in $$new_props) $$invalidate(5, toggle = $$new_props.toggle);
  		if ("pressed" in $$new_props) $$invalidate(0, pressed = $$new_props.pressed);
  		if ("href" in $$new_props) $$invalidate(6, href = $$new_props.href);
  		if ("$$scope" in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			ripple,
  			color,
  			toggle,
  			pressed,
  			href,
  			element,
  			toggleButton,
  			context,
  			oldToggle,
  			props
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(14, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(1, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(2, className = $$new_props.className);
  		if ("ripple" in $$props) $$invalidate(3, ripple = $$new_props.ripple);
  		if ("color" in $$props) $$invalidate(4, color = $$new_props.color);
  		if ("toggle" in $$props) $$invalidate(5, toggle = $$new_props.toggle);
  		if ("pressed" in $$props) $$invalidate(0, pressed = $$new_props.pressed);
  		if ("href" in $$props) $$invalidate(6, href = $$new_props.href);
  		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
  		if ("toggleButton" in $$props) $$invalidate(12, toggleButton = $$new_props.toggleButton);
  		if ("context" in $$props) $$invalidate(10, context = $$new_props.context);
  		if ("oldToggle" in $$props) $$invalidate(13, oldToggle = $$new_props.oldToggle);
  		if ("props" in $$props) $$invalidate(8, props = $$new_props.props);
  	};

  	let props;

  	$$self.$$.update = () => {
  		 $$invalidate(8, props = exclude($$props, ["use", "class", "ripple", "color", "toggle", "pressed", "href"]));

  		if ($$self.$$.dirty & /*element, toggle, oldToggle, ripple, toggleButton, pressed*/ 12457) {
  			 if (element && toggle !== oldToggle) {
  				if (toggle) {
  					$$invalidate(12, toggleButton = new MDCIconButtonToggle(element));

  					if (!ripple) {
  						toggleButton.ripple.destroy();
  					}

  					$$invalidate(12, toggleButton.on = pressed, toggleButton);
  				} else if (oldToggle) {
  					toggleButton && toggleButton.destroy();
  					$$invalidate(12, toggleButton = null);
  				}

  				$$invalidate(13, oldToggle = toggle);
  			}
  		}

  		if ($$self.$$.dirty & /*toggleButton, pressed*/ 4097) {
  			 if (toggleButton && toggleButton.on !== pressed) {
  				$$invalidate(12, toggleButton.on = pressed, toggleButton);
  			}
  		}
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		pressed,
  		use,
  		className,
  		ripple,
  		color,
  		toggle,
  		href,
  		element,
  		props,
  		forwardEvents,
  		context,
  		handleChange,
  		toggleButton,
  		oldToggle,
  		$$props,
  		$$scope,
  		$$slots,
  		a_binding,
  		button_binding
  	];
  }

  class IconButton extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
  			use: 1,
  			class: 2,
  			ripple: 3,
  			color: 4,
  			toggle: 5,
  			pressed: 0,
  			href: 6
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "IconButton",
  			options,
  			id: create_fragment$5.name
  		});
  	}

  	get use() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get ripple() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set ripple(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get color() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set color(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get toggle() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set toggle(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get pressed() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set pressed(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get href() {
  		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set href(value) {
  		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* node_modules/@smui/common/Icon.svelte generated by Svelte v3.16.7 */
  const file$5 = "node_modules/@smui/common/Icon.svelte";

  function create_fragment$6(ctx) {
  	let i;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[10].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], null);

  	let i_levels = [
  		{
  			class: "\n    " + /*className*/ ctx[1] + "\n    " + (/*context*/ ctx[7] === "button"
  			? "mdc-button__icon"
  			: "") + "\n    " + (/*context*/ ctx[7] === "fab" ? "mdc-fab__icon" : "") + "\n    " + (/*context*/ ctx[7] === "icon-button"
  			? "mdc-icon-button__icon"
  			: "") + "\n    " + (/*context*/ ctx[7] === "icon-button" && /*on*/ ctx[2]
  			? "mdc-icon-button__icon--on"
  			: "") + "\n    " + (/*context*/ ctx[7] === "chip" ? "mdc-chip__icon" : "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*leading*/ ctx[3]
  			? "mdc-chip__icon--leading"
  			: "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*leadingHidden*/ ctx[4]
  			? "mdc-chip__icon--leading-hidden"
  			: "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*trailing*/ ctx[5]
  			? "mdc-chip__icon--trailing"
  			: "") + "\n    " + (/*context*/ ctx[7] === "tab" ? "mdc-tab__icon" : "") + "\n  "
  		},
  		{ "aria-hidden": "true" },
  		exclude(/*$$props*/ ctx[8], ["use", "class", "on", "leading", "leadingHidden", "trailing"])
  	];

  	let i_data = {};

  	for (let i = 0; i < i_levels.length; i += 1) {
  		i_data = assign(i_data, i_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			i = element("i");
  			if (default_slot) default_slot.c();
  			set_attributes(i, i_data);
  			add_location(i, file$5, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, i, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[6].call(null, i))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, i, anchor);

  			if (default_slot) {
  				default_slot.m(i, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 512) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[9], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, null));
  			}

  			set_attributes(i, get_spread_update(i_levels, [
  				dirty & /*className, context, on, leading, leadingHidden, trailing*/ 190 && ({
  					class: "\n    " + /*className*/ ctx[1] + "\n    " + (/*context*/ ctx[7] === "button"
  					? "mdc-button__icon"
  					: "") + "\n    " + (/*context*/ ctx[7] === "fab" ? "mdc-fab__icon" : "") + "\n    " + (/*context*/ ctx[7] === "icon-button"
  					? "mdc-icon-button__icon"
  					: "") + "\n    " + (/*context*/ ctx[7] === "icon-button" && /*on*/ ctx[2]
  					? "mdc-icon-button__icon--on"
  					: "") + "\n    " + (/*context*/ ctx[7] === "chip" ? "mdc-chip__icon" : "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*leading*/ ctx[3]
  					? "mdc-chip__icon--leading"
  					: "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*leadingHidden*/ ctx[4]
  					? "mdc-chip__icon--leading-hidden"
  					: "") + "\n    " + (/*context*/ ctx[7] === "chip" && /*trailing*/ ctx[5]
  					? "mdc-chip__icon--trailing"
  					: "") + "\n    " + (/*context*/ ctx[7] === "tab" ? "mdc-tab__icon" : "") + "\n  "
  				}),
  				{ "aria-hidden": "true" },
  				dirty & /*exclude, $$props*/ 256 && exclude(/*$$props*/ ctx[8], ["use", "class", "on", "leading", "leadingHidden", "trailing"])
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(i);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$6.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$6($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { on = false } = $$props;
  	let { leading = false } = $$props;
  	let { leadingHidden = false } = $$props;
  	let { trailing = false } = $$props;
  	const context = getContext("SMUI:icon:context");
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(8, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("on" in $$new_props) $$invalidate(2, on = $$new_props.on);
  		if ("leading" in $$new_props) $$invalidate(3, leading = $$new_props.leading);
  		if ("leadingHidden" in $$new_props) $$invalidate(4, leadingHidden = $$new_props.leadingHidden);
  		if ("trailing" in $$new_props) $$invalidate(5, trailing = $$new_props.trailing);
  		if ("$$scope" in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			on,
  			leading,
  			leadingHidden,
  			trailing
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(8, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("on" in $$props) $$invalidate(2, on = $$new_props.on);
  		if ("leading" in $$props) $$invalidate(3, leading = $$new_props.leading);
  		if ("leadingHidden" in $$props) $$invalidate(4, leadingHidden = $$new_props.leadingHidden);
  		if ("trailing" in $$props) $$invalidate(5, trailing = $$new_props.trailing);
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		on,
  		leading,
  		leadingHidden,
  		trailing,
  		forwardEvents,
  		context,
  		$$props,
  		$$scope,
  		$$slots
  	];
  }

  class Icon extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
  			use: 0,
  			class: 1,
  			on: 2,
  			leading: 3,
  			leadingHidden: 4,
  			trailing: 5
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Icon",
  			options,
  			id: create_fragment$6.name
  		});
  	}

  	get use() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get on() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set on(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get leading() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set leading(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get leadingHidden() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set leadingHidden(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get trailing() {
  		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set trailing(value) {
  		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$3 = {
      ANCHOR: 'mdc-menu-surface--anchor',
      ANIMATING_CLOSED: 'mdc-menu-surface--animating-closed',
      ANIMATING_OPEN: 'mdc-menu-surface--animating-open',
      FIXED: 'mdc-menu-surface--fixed',
      OPEN: 'mdc-menu-surface--open',
      ROOT: 'mdc-menu-surface',
  };
  // tslint:disable:object-literal-sort-keys
  var strings$4 = {
      CLOSED_EVENT: 'MDCMenuSurface:closed',
      OPENED_EVENT: 'MDCMenuSurface:opened',
      FOCUSABLE_ELEMENTS: [
          'button:not(:disabled)', '[href]:not([aria-disabled="true"])', 'input:not(:disabled)',
          'select:not(:disabled)', 'textarea:not(:disabled)', '[tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])',
      ].join(', '),
  };
  // tslint:enable:object-literal-sort-keys
  var numbers$2 = {
      /** Total duration of menu-surface open animation. */
      TRANSITION_OPEN_DURATION: 120,
      /** Total duration of menu-surface close animation. */
      TRANSITION_CLOSE_DURATION: 75,
      /** Margin left to the edge of the viewport when menu-surface is at maximum possible height. */
      MARGIN_TO_EDGE: 32,
      /** Ratio of anchor width to menu-surface width for switching from corner positioning to center positioning. */
      ANCHOR_TO_MENU_SURFACE_WIDTH_RATIO: 0.67,
  };
  /**
   * Enum for bits in the {@see Corner) bitmap.
   */
  var CornerBit;
  (function (CornerBit) {
      CornerBit[CornerBit["BOTTOM"] = 1] = "BOTTOM";
      CornerBit[CornerBit["CENTER"] = 2] = "CENTER";
      CornerBit[CornerBit["RIGHT"] = 4] = "RIGHT";
      CornerBit[CornerBit["FLIP_RTL"] = 8] = "FLIP_RTL";
  })(CornerBit || (CornerBit = {}));
  /**
   * Enum for representing an element corner for positioning the menu-surface.
   *
   * The START constants map to LEFT if element directionality is left
   * to right and RIGHT if the directionality is right to left.
   * Likewise END maps to RIGHT or LEFT depending on the directionality.
   */
  var Corner;
  (function (Corner) {
      Corner[Corner["TOP_LEFT"] = 0] = "TOP_LEFT";
      Corner[Corner["TOP_RIGHT"] = 4] = "TOP_RIGHT";
      Corner[Corner["BOTTOM_LEFT"] = 1] = "BOTTOM_LEFT";
      Corner[Corner["BOTTOM_RIGHT"] = 5] = "BOTTOM_RIGHT";
      Corner[Corner["TOP_START"] = 8] = "TOP_START";
      Corner[Corner["TOP_END"] = 12] = "TOP_END";
      Corner[Corner["BOTTOM_START"] = 9] = "BOTTOM_START";
      Corner[Corner["BOTTOM_END"] = 13] = "BOTTOM_END";
  })(Corner || (Corner = {}));
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$4 = {
      LIST_ITEM_ACTIVATED_CLASS: 'mdc-list-item--activated',
      LIST_ITEM_CLASS: 'mdc-list-item',
      LIST_ITEM_DISABLED_CLASS: 'mdc-list-item--disabled',
      LIST_ITEM_SELECTED_CLASS: 'mdc-list-item--selected',
      ROOT: 'mdc-list',
  };
  var strings$5 = {
      ACTION_EVENT: 'MDCList:action',
      ARIA_CHECKED: 'aria-checked',
      ARIA_CHECKED_CHECKBOX_SELECTOR: '[role="checkbox"][aria-checked="true"]',
      ARIA_CHECKED_RADIO_SELECTOR: '[role="radio"][aria-checked="true"]',
      ARIA_CURRENT: 'aria-current',
      ARIA_DISABLED: 'aria-disabled',
      ARIA_ORIENTATION: 'aria-orientation',
      ARIA_ORIENTATION_HORIZONTAL: 'horizontal',
      ARIA_ROLE_CHECKBOX_SELECTOR: '[role="checkbox"]',
      ARIA_SELECTED: 'aria-selected',
      CHECKBOX_RADIO_SELECTOR: 'input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled)',
      CHECKBOX_SELECTOR: 'input[type="checkbox"]:not(:disabled)',
      CHILD_ELEMENTS_TO_TOGGLE_TABINDEX: "\n    ." + cssClasses$4.LIST_ITEM_CLASS + " button:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " a\n  ",
      FOCUSABLE_CHILD_ELEMENTS: "\n    ." + cssClasses$4.LIST_ITEM_CLASS + " button:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " a,\n    ." + cssClasses$4.LIST_ITEM_CLASS + " input[type=\"radio\"]:not(:disabled),\n    ." + cssClasses$4.LIST_ITEM_CLASS + " input[type=\"checkbox\"]:not(:disabled)\n  ",
      RADIO_SELECTOR: 'input[type="radio"]:not(:disabled)',
  };
  var numbers$3 = {
      UNSET_INDEX: -1,
  };
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var ELEMENTS_KEY_ALLOWED_IN = ['input', 'button', 'textarea', 'select'];
  function isNumberArray(selectedIndex) {
      return selectedIndex instanceof Array;
  }
  var MDCListFoundation = /** @class */ (function (_super) {
      __extends(MDCListFoundation, _super);
      function MDCListFoundation(adapter) {
          var _this = _super.call(this, __assign({}, MDCListFoundation.defaultAdapter, adapter)) || this;
          _this.wrapFocus_ = false;
          _this.isVertical_ = true;
          _this.isSingleSelectionList_ = false;
          _this.selectedIndex_ = numbers$3.UNSET_INDEX;
          _this.focusedItemIndex_ = numbers$3.UNSET_INDEX;
          _this.useActivatedClass_ = false;
          _this.ariaCurrentAttrValue_ = null;
          _this.isCheckboxList_ = false;
          _this.isRadioList_ = false;
          return _this;
      }
      Object.defineProperty(MDCListFoundation, "strings", {
          get: function () {
              return strings$5;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCListFoundation, "cssClasses", {
          get: function () {
              return cssClasses$4;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCListFoundation, "numbers", {
          get: function () {
              return numbers$3;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCListFoundation, "defaultAdapter", {
          get: function () {
              return {
                  addClassForElementIndex: function () { return undefined; },
                  focusItemAtIndex: function () { return undefined; },
                  getAttributeForElementIndex: function () { return null; },
                  getFocusedElementIndex: function () { return 0; },
                  getListItemCount: function () { return 0; },
                  hasCheckboxAtIndex: function () { return false; },
                  hasRadioAtIndex: function () { return false; },
                  isCheckboxCheckedAtIndex: function () { return false; },
                  isFocusInsideList: function () { return false; },
                  isRootFocused: function () { return false; },
                  notifyAction: function () { return undefined; },
                  removeClassForElementIndex: function () { return undefined; },
                  setAttributeForElementIndex: function () { return undefined; },
                  setCheckedCheckboxOrRadioAtIndex: function () { return undefined; },
                  setTabIndexForListItemChildren: function () { return undefined; },
              };
          },
          enumerable: true,
          configurable: true
      });
      MDCListFoundation.prototype.layout = function () {
          if (this.adapter_.getListItemCount() === 0) {
              return;
          }
          if (this.adapter_.hasCheckboxAtIndex(0)) {
              this.isCheckboxList_ = true;
          }
          else if (this.adapter_.hasRadioAtIndex(0)) {
              this.isRadioList_ = true;
          }
      };
      /**
       * Sets the private wrapFocus_ variable.
       */
      MDCListFoundation.prototype.setWrapFocus = function (value) {
          this.wrapFocus_ = value;
      };
      /**
       * Sets the isVertical_ private variable.
       */
      MDCListFoundation.prototype.setVerticalOrientation = function (value) {
          this.isVertical_ = value;
      };
      /**
       * Sets the isSingleSelectionList_ private variable.
       */
      MDCListFoundation.prototype.setSingleSelection = function (value) {
          this.isSingleSelectionList_ = value;
      };
      /**
       * Sets the useActivatedClass_ private variable.
       */
      MDCListFoundation.prototype.setUseActivatedClass = function (useActivated) {
          this.useActivatedClass_ = useActivated;
      };
      MDCListFoundation.prototype.getSelectedIndex = function () {
          return this.selectedIndex_;
      };
      MDCListFoundation.prototype.setSelectedIndex = function (index) {
          if (!this.isIndexValid_(index)) {
              return;
          }
          if (this.isCheckboxList_) {
              this.setCheckboxAtIndex_(index);
          }
          else if (this.isRadioList_) {
              this.setRadioAtIndex_(index);
          }
          else {
              this.setSingleSelectionAtIndex_(index);
          }
      };
      /**
       * Focus in handler for the list items.
       */
      MDCListFoundation.prototype.handleFocusIn = function (_, listItemIndex) {
          if (listItemIndex >= 0) {
              this.adapter_.setTabIndexForListItemChildren(listItemIndex, '0');
          }
      };
      /**
       * Focus out handler for the list items.
       */
      MDCListFoundation.prototype.handleFocusOut = function (_, listItemIndex) {
          var _this = this;
          if (listItemIndex >= 0) {
              this.adapter_.setTabIndexForListItemChildren(listItemIndex, '-1');
          }
          /**
           * Between Focusout & Focusin some browsers do not have focus on any element. Setting a delay to wait till the focus
           * is moved to next element.
           */
          setTimeout(function () {
              if (!_this.adapter_.isFocusInsideList()) {
                  _this.setTabindexToFirstSelectedItem_();
              }
          }, 0);
      };
      /**
       * Key handler for the list.
       */
      MDCListFoundation.prototype.handleKeydown = function (evt, isRootListItem, listItemIndex) {
          var isArrowLeft = evt.key === 'ArrowLeft' || evt.keyCode === 37;
          var isArrowUp = evt.key === 'ArrowUp' || evt.keyCode === 38;
          var isArrowRight = evt.key === 'ArrowRight' || evt.keyCode === 39;
          var isArrowDown = evt.key === 'ArrowDown' || evt.keyCode === 40;
          var isHome = evt.key === 'Home' || evt.keyCode === 36;
          var isEnd = evt.key === 'End' || evt.keyCode === 35;
          var isEnter = evt.key === 'Enter' || evt.keyCode === 13;
          var isSpace = evt.key === 'Space' || evt.keyCode === 32;
          if (this.adapter_.isRootFocused()) {
              if (isArrowUp || isEnd) {
                  evt.preventDefault();
                  this.focusLastElement();
              }
              else if (isArrowDown || isHome) {
                  evt.preventDefault();
                  this.focusFirstElement();
              }
              return;
          }
          var currentIndex = this.adapter_.getFocusedElementIndex();
          if (currentIndex === -1) {
              currentIndex = listItemIndex;
              if (currentIndex < 0) {
                  // If this event doesn't have a mdc-list-item ancestor from the
                  // current list (not from a sublist), return early.
                  return;
              }
          }
          var nextIndex;
          if ((this.isVertical_ && isArrowDown) || (!this.isVertical_ && isArrowRight)) {
              this.preventDefaultEvent_(evt);
              nextIndex = this.focusNextElement(currentIndex);
          }
          else if ((this.isVertical_ && isArrowUp) || (!this.isVertical_ && isArrowLeft)) {
              this.preventDefaultEvent_(evt);
              nextIndex = this.focusPrevElement(currentIndex);
          }
          else if (isHome) {
              this.preventDefaultEvent_(evt);
              nextIndex = this.focusFirstElement();
          }
          else if (isEnd) {
              this.preventDefaultEvent_(evt);
              nextIndex = this.focusLastElement();
          }
          else if (isEnter || isSpace) {
              if (isRootListItem) {
                  // Return early if enter key is pressed on anchor element which triggers synthetic MouseEvent event.
                  var target = evt.target;
                  if (target && target.tagName === 'A' && isEnter) {
                      return;
                  }
                  this.preventDefaultEvent_(evt);
                  if (this.isSelectableList_()) {
                      this.setSelectedIndexOnAction_(currentIndex);
                  }
                  this.adapter_.notifyAction(currentIndex);
              }
          }
          this.focusedItemIndex_ = currentIndex;
          if (nextIndex !== undefined) {
              this.setTabindexAtIndex_(nextIndex);
              this.focusedItemIndex_ = nextIndex;
          }
      };
      /**
       * Click handler for the list.
       */
      MDCListFoundation.prototype.handleClick = function (index, toggleCheckbox) {
          if (index === numbers$3.UNSET_INDEX) {
              return;
          }
          if (this.isSelectableList_()) {
              this.setSelectedIndexOnAction_(index, toggleCheckbox);
          }
          this.adapter_.notifyAction(index);
          this.setTabindexAtIndex_(index);
          this.focusedItemIndex_ = index;
      };
      /**
       * Focuses the next element on the list.
       */
      MDCListFoundation.prototype.focusNextElement = function (index) {
          var count = this.adapter_.getListItemCount();
          var nextIndex = index + 1;
          if (nextIndex >= count) {
              if (this.wrapFocus_) {
                  nextIndex = 0;
              }
              else {
                  // Return early because last item is already focused.
                  return index;
              }
          }
          this.adapter_.focusItemAtIndex(nextIndex);
          return nextIndex;
      };
      /**
       * Focuses the previous element on the list.
       */
      MDCListFoundation.prototype.focusPrevElement = function (index) {
          var prevIndex = index - 1;
          if (prevIndex < 0) {
              if (this.wrapFocus_) {
                  prevIndex = this.adapter_.getListItemCount() - 1;
              }
              else {
                  // Return early because first item is already focused.
                  return index;
              }
          }
          this.adapter_.focusItemAtIndex(prevIndex);
          return prevIndex;
      };
      MDCListFoundation.prototype.focusFirstElement = function () {
          this.adapter_.focusItemAtIndex(0);
          return 0;
      };
      MDCListFoundation.prototype.focusLastElement = function () {
          var lastIndex = this.adapter_.getListItemCount() - 1;
          this.adapter_.focusItemAtIndex(lastIndex);
          return lastIndex;
      };
      /**
       * @param itemIndex Index of the list item
       * @param isEnabled Sets the list item to enabled or disabled.
       */
      MDCListFoundation.prototype.setEnabled = function (itemIndex, isEnabled) {
          if (!this.isIndexValid_(itemIndex)) {
              return;
          }
          if (isEnabled) {
              this.adapter_.removeClassForElementIndex(itemIndex, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
              this.adapter_.setAttributeForElementIndex(itemIndex, strings$5.ARIA_DISABLED, 'false');
          }
          else {
              this.adapter_.addClassForElementIndex(itemIndex, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
              this.adapter_.setAttributeForElementIndex(itemIndex, strings$5.ARIA_DISABLED, 'true');
          }
      };
      /**
       * Ensures that preventDefault is only called if the containing element doesn't
       * consume the event, and it will cause an unintended scroll.
       */
      MDCListFoundation.prototype.preventDefaultEvent_ = function (evt) {
          var target = evt.target;
          var tagName = ("" + target.tagName).toLowerCase();
          if (ELEMENTS_KEY_ALLOWED_IN.indexOf(tagName) === -1) {
              evt.preventDefault();
          }
      };
      MDCListFoundation.prototype.setSingleSelectionAtIndex_ = function (index) {
          if (this.selectedIndex_ === index) {
              return;
          }
          var selectedClassName = cssClasses$4.LIST_ITEM_SELECTED_CLASS;
          if (this.useActivatedClass_) {
              selectedClassName = cssClasses$4.LIST_ITEM_ACTIVATED_CLASS;
          }
          if (this.selectedIndex_ !== numbers$3.UNSET_INDEX) {
              this.adapter_.removeClassForElementIndex(this.selectedIndex_, selectedClassName);
          }
          this.adapter_.addClassForElementIndex(index, selectedClassName);
          this.setAriaForSingleSelectionAtIndex_(index);
          this.selectedIndex_ = index;
      };
      /**
       * Sets aria attribute for single selection at given index.
       */
      MDCListFoundation.prototype.setAriaForSingleSelectionAtIndex_ = function (index) {
          // Detect the presence of aria-current and get the value only during list initialization when it is in unset state.
          if (this.selectedIndex_ === numbers$3.UNSET_INDEX) {
              this.ariaCurrentAttrValue_ =
                  this.adapter_.getAttributeForElementIndex(index, strings$5.ARIA_CURRENT);
          }
          var isAriaCurrent = this.ariaCurrentAttrValue_ !== null;
          var ariaAttribute = isAriaCurrent ? strings$5.ARIA_CURRENT : strings$5.ARIA_SELECTED;
          if (this.selectedIndex_ !== numbers$3.UNSET_INDEX) {
              this.adapter_.setAttributeForElementIndex(this.selectedIndex_, ariaAttribute, 'false');
          }
          var ariaAttributeValue = isAriaCurrent ? this.ariaCurrentAttrValue_ : 'true';
          this.adapter_.setAttributeForElementIndex(index, ariaAttribute, ariaAttributeValue);
      };
      /**
       * Toggles radio at give index. Radio doesn't change the checked state if it is already checked.
       */
      MDCListFoundation.prototype.setRadioAtIndex_ = function (index) {
          this.adapter_.setCheckedCheckboxOrRadioAtIndex(index, true);
          if (this.selectedIndex_ !== numbers$3.UNSET_INDEX) {
              this.adapter_.setAttributeForElementIndex(this.selectedIndex_, strings$5.ARIA_CHECKED, 'false');
          }
          this.adapter_.setAttributeForElementIndex(index, strings$5.ARIA_CHECKED, 'true');
          this.selectedIndex_ = index;
      };
      MDCListFoundation.prototype.setCheckboxAtIndex_ = function (index) {
          for (var i = 0; i < this.adapter_.getListItemCount(); i++) {
              var isChecked = false;
              if (index.indexOf(i) >= 0) {
                  isChecked = true;
              }
              this.adapter_.setCheckedCheckboxOrRadioAtIndex(i, isChecked);
              this.adapter_.setAttributeForElementIndex(i, strings$5.ARIA_CHECKED, isChecked ? 'true' : 'false');
          }
          this.selectedIndex_ = index;
      };
      MDCListFoundation.prototype.setTabindexAtIndex_ = function (index) {
          if (this.focusedItemIndex_ === numbers$3.UNSET_INDEX && index !== 0) {
              // If no list item was selected set first list item's tabindex to -1.
              // Generally, tabindex is set to 0 on first list item of list that has no preselected items.
              this.adapter_.setAttributeForElementIndex(0, 'tabindex', '-1');
          }
          else if (this.focusedItemIndex_ >= 0 && this.focusedItemIndex_ !== index) {
              this.adapter_.setAttributeForElementIndex(this.focusedItemIndex_, 'tabindex', '-1');
          }
          this.adapter_.setAttributeForElementIndex(index, 'tabindex', '0');
      };
      /**
       * @return Return true if it is single selectin list, checkbox list or radio list.
       */
      MDCListFoundation.prototype.isSelectableList_ = function () {
          return this.isSingleSelectionList_ || this.isCheckboxList_ || this.isRadioList_;
      };
      MDCListFoundation.prototype.setTabindexToFirstSelectedItem_ = function () {
          var targetIndex = 0;
          if (this.isSelectableList_()) {
              if (typeof this.selectedIndex_ === 'number' && this.selectedIndex_ !== numbers$3.UNSET_INDEX) {
                  targetIndex = this.selectedIndex_;
              }
              else if (isNumberArray(this.selectedIndex_) && this.selectedIndex_.length > 0) {
                  targetIndex = this.selectedIndex_.reduce(function (currentIndex, minIndex) { return Math.min(currentIndex, minIndex); });
              }
          }
          this.setTabindexAtIndex_(targetIndex);
      };
      MDCListFoundation.prototype.isIndexValid_ = function (index) {
          var _this = this;
          if (index instanceof Array) {
              if (!this.isCheckboxList_) {
                  throw new Error('MDCListFoundation: Array of index is only supported for checkbox based list');
              }
              if (index.length === 0) {
                  return true;
              }
              else {
                  return index.some(function (i) { return _this.isIndexInRange_(i); });
              }
          }
          else if (typeof index === 'number') {
              if (this.isCheckboxList_) {
                  throw new Error('MDCListFoundation: Expected array of index for checkbox based list but got number: ' + index);
              }
              return this.isIndexInRange_(index);
          }
          else {
              return false;
          }
      };
      MDCListFoundation.prototype.isIndexInRange_ = function (index) {
          var listSize = this.adapter_.getListItemCount();
          return index >= 0 && index < listSize;
      };
      MDCListFoundation.prototype.setSelectedIndexOnAction_ = function (index, toggleCheckbox) {
          if (toggleCheckbox === void 0) { toggleCheckbox = true; }
          if (this.isCheckboxList_) {
              this.toggleCheckboxAtIndex_(index, toggleCheckbox);
          }
          else {
              this.setSelectedIndex(index);
          }
      };
      MDCListFoundation.prototype.toggleCheckboxAtIndex_ = function (index, toggleCheckbox) {
          var isChecked = this.adapter_.isCheckboxCheckedAtIndex(index);
          if (toggleCheckbox) {
              isChecked = !isChecked;
              this.adapter_.setCheckedCheckboxOrRadioAtIndex(index, isChecked);
          }
          this.adapter_.setAttributeForElementIndex(index, strings$5.ARIA_CHECKED, isChecked ? 'true' : 'false');
          // If none of the checkbox items are selected and selectedIndex is not initialized then provide a default value.
          var selectedIndexes = this.selectedIndex_ === numbers$3.UNSET_INDEX ? [] : this.selectedIndex_.slice();
          if (isChecked) {
              selectedIndexes.push(index);
          }
          else {
              selectedIndexes = selectedIndexes.filter(function (i) { return i !== index; });
          }
          this.selectedIndex_ = selectedIndexes;
      };
      return MDCListFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCList = /** @class */ (function (_super) {
      __extends(MDCList, _super);
      function MDCList() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      Object.defineProperty(MDCList.prototype, "vertical", {
          set: function (value) {
              this.foundation_.setVerticalOrientation(value);
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCList.prototype, "listElements", {
          get: function () {
              return [].slice.call(this.root_.querySelectorAll("." + cssClasses$4.LIST_ITEM_CLASS));
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCList.prototype, "wrapFocus", {
          set: function (value) {
              this.foundation_.setWrapFocus(value);
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCList.prototype, "singleSelection", {
          set: function (isSingleSelectionList) {
              this.foundation_.setSingleSelection(isSingleSelectionList);
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCList.prototype, "selectedIndex", {
          get: function () {
              return this.foundation_.getSelectedIndex();
          },
          set: function (index) {
              this.foundation_.setSelectedIndex(index);
          },
          enumerable: true,
          configurable: true
      });
      MDCList.attachTo = function (root) {
          return new MDCList(root);
      };
      MDCList.prototype.initialSyncWithDOM = function () {
          this.handleClick_ = this.handleClickEvent_.bind(this);
          this.handleKeydown_ = this.handleKeydownEvent_.bind(this);
          this.focusInEventListener_ = this.handleFocusInEvent_.bind(this);
          this.focusOutEventListener_ = this.handleFocusOutEvent_.bind(this);
          this.listen('keydown', this.handleKeydown_);
          this.listen('click', this.handleClick_);
          this.listen('focusin', this.focusInEventListener_);
          this.listen('focusout', this.focusOutEventListener_);
          this.layout();
          this.initializeListType();
      };
      MDCList.prototype.destroy = function () {
          this.unlisten('keydown', this.handleKeydown_);
          this.unlisten('click', this.handleClick_);
          this.unlisten('focusin', this.focusInEventListener_);
          this.unlisten('focusout', this.focusOutEventListener_);
      };
      MDCList.prototype.layout = function () {
          var direction = this.root_.getAttribute(strings$5.ARIA_ORIENTATION);
          this.vertical = direction !== strings$5.ARIA_ORIENTATION_HORIZONTAL;
          // List items need to have at least tabindex=-1 to be focusable.
          [].slice.call(this.root_.querySelectorAll('.mdc-list-item:not([tabindex])'))
              .forEach(function (el) {
              el.setAttribute('tabindex', '-1');
          });
          // Child button/a elements are not tabbable until the list item is focused.
          [].slice.call(this.root_.querySelectorAll(strings$5.FOCUSABLE_CHILD_ELEMENTS))
              .forEach(function (el) { return el.setAttribute('tabindex', '-1'); });
          this.foundation_.layout();
      };
      /**
       * Initialize selectedIndex value based on pre-selected checkbox list items, single selection or radio.
       */
      MDCList.prototype.initializeListType = function () {
          var _this = this;
          var checkboxListItems = this.root_.querySelectorAll(strings$5.ARIA_ROLE_CHECKBOX_SELECTOR);
          var singleSelectedListItem = this.root_.querySelector("\n      ." + cssClasses$4.LIST_ITEM_ACTIVATED_CLASS + ",\n      ." + cssClasses$4.LIST_ITEM_SELECTED_CLASS + "\n    ");
          var radioSelectedListItem = this.root_.querySelector(strings$5.ARIA_CHECKED_RADIO_SELECTOR);
          if (checkboxListItems.length) {
              var preselectedItems = this.root_.querySelectorAll(strings$5.ARIA_CHECKED_CHECKBOX_SELECTOR);
              this.selectedIndex =
                  [].map.call(preselectedItems, function (listItem) { return _this.listElements.indexOf(listItem); });
          }
          else if (singleSelectedListItem) {
              if (singleSelectedListItem.classList.contains(cssClasses$4.LIST_ITEM_ACTIVATED_CLASS)) {
                  this.foundation_.setUseActivatedClass(true);
              }
              this.singleSelection = true;
              this.selectedIndex = this.listElements.indexOf(singleSelectedListItem);
          }
          else if (radioSelectedListItem) {
              this.selectedIndex = this.listElements.indexOf(radioSelectedListItem);
          }
      };
      /**
       * Updates the list item at itemIndex to the desired isEnabled state.
       * @param itemIndex Index of the list item
       * @param isEnabled Sets the list item to enabled or disabled.
       */
      MDCList.prototype.setEnabled = function (itemIndex, isEnabled) {
          this.foundation_.setEnabled(itemIndex, isEnabled);
      };
      MDCList.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          var adapter = {
              addClassForElementIndex: function (index, className) {
                  var element = _this.listElements[index];
                  if (element) {
                      element.classList.add(className);
                  }
              },
              focusItemAtIndex: function (index) {
                  var element = _this.listElements[index];
                  if (element) {
                      element.focus();
                  }
              },
              getAttributeForElementIndex: function (index, attr) { return _this.listElements[index].getAttribute(attr); },
              getFocusedElementIndex: function () { return _this.listElements.indexOf(document.activeElement); },
              getListItemCount: function () { return _this.listElements.length; },
              hasCheckboxAtIndex: function (index) {
                  var listItem = _this.listElements[index];
                  return !!listItem.querySelector(strings$5.CHECKBOX_SELECTOR);
              },
              hasRadioAtIndex: function (index) {
                  var listItem = _this.listElements[index];
                  return !!listItem.querySelector(strings$5.RADIO_SELECTOR);
              },
              isCheckboxCheckedAtIndex: function (index) {
                  var listItem = _this.listElements[index];
                  var toggleEl = listItem.querySelector(strings$5.CHECKBOX_SELECTOR);
                  return toggleEl.checked;
              },
              isFocusInsideList: function () {
                  return _this.root_.contains(document.activeElement);
              },
              isRootFocused: function () { return document.activeElement === _this.root_; },
              notifyAction: function (index) {
                  _this.emit(strings$5.ACTION_EVENT, { index: index }, /** shouldBubble */ true);
              },
              removeClassForElementIndex: function (index, className) {
                  var element = _this.listElements[index];
                  if (element) {
                      element.classList.remove(className);
                  }
              },
              setAttributeForElementIndex: function (index, attr, value) {
                  var element = _this.listElements[index];
                  if (element) {
                      element.setAttribute(attr, value);
                  }
              },
              setCheckedCheckboxOrRadioAtIndex: function (index, isChecked) {
                  var listItem = _this.listElements[index];
                  var toggleEl = listItem.querySelector(strings$5.CHECKBOX_RADIO_SELECTOR);
                  toggleEl.checked = isChecked;
                  var event = document.createEvent('Event');
                  event.initEvent('change', true, true);
                  toggleEl.dispatchEvent(event);
              },
              setTabIndexForListItemChildren: function (listItemIndex, tabIndexValue) {
                  var element = _this.listElements[listItemIndex];
                  var listItemChildren = [].slice.call(element.querySelectorAll(strings$5.CHILD_ELEMENTS_TO_TOGGLE_TABINDEX));
                  listItemChildren.forEach(function (el) { return el.setAttribute('tabindex', tabIndexValue); });
              },
          };
          return new MDCListFoundation(adapter);
      };
      /**
       * Used to figure out which list item this event is targetting. Or returns -1 if
       * there is no list item
       */
      MDCList.prototype.getListItemIndex_ = function (evt) {
          var eventTarget = evt.target;
          var nearestParent = closest(eventTarget, "." + cssClasses$4.LIST_ITEM_CLASS + ", ." + cssClasses$4.ROOT);
          // Get the index of the element if it is a list item.
          if (nearestParent && matches(nearestParent, "." + cssClasses$4.LIST_ITEM_CLASS)) {
              return this.listElements.indexOf(nearestParent);
          }
          return -1;
      };
      /**
       * Used to figure out which element was clicked before sending the event to the foundation.
       */
      MDCList.prototype.handleFocusInEvent_ = function (evt) {
          var index = this.getListItemIndex_(evt);
          this.foundation_.handleFocusIn(evt, index);
      };
      /**
       * Used to figure out which element was clicked before sending the event to the foundation.
       */
      MDCList.prototype.handleFocusOutEvent_ = function (evt) {
          var index = this.getListItemIndex_(evt);
          this.foundation_.handleFocusOut(evt, index);
      };
      /**
       * Used to figure out which element was focused when keydown event occurred before sending the event to the
       * foundation.
       */
      MDCList.prototype.handleKeydownEvent_ = function (evt) {
          var index = this.getListItemIndex_(evt);
          var target = evt.target;
          this.foundation_.handleKeydown(evt, target.classList.contains(cssClasses$4.LIST_ITEM_CLASS), index);
      };
      /**
       * Used to figure out which element was clicked before sending the event to the foundation.
       */
      MDCList.prototype.handleClickEvent_ = function (evt) {
          var index = this.getListItemIndex_(evt);
          var target = evt.target;
          // Toggle the checkbox only if it's not the target of the event, or the checkbox will have 2 change events.
          var toggleCheckbox = !matches(target, strings$5.CHECKBOX_RADIO_SELECTOR);
          this.foundation_.handleClick(index, toggleCheckbox);
      };
      return MDCList;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCMenuSurfaceFoundation = /** @class */ (function (_super) {
      __extends(MDCMenuSurfaceFoundation, _super);
      function MDCMenuSurfaceFoundation(adapter) {
          var _this = _super.call(this, __assign({}, MDCMenuSurfaceFoundation.defaultAdapter, adapter)) || this;
          _this.isOpen_ = false;
          _this.isQuickOpen_ = false;
          _this.isHoistedElement_ = false;
          _this.isFixedPosition_ = false;
          _this.openAnimationEndTimerId_ = 0;
          _this.closeAnimationEndTimerId_ = 0;
          _this.animationRequestId_ = 0;
          _this.anchorCorner_ = Corner.TOP_START;
          _this.anchorMargin_ = { top: 0, right: 0, bottom: 0, left: 0 };
          _this.position_ = { x: 0, y: 0 };
          return _this;
      }
      Object.defineProperty(MDCMenuSurfaceFoundation, "cssClasses", {
          get: function () {
              return cssClasses$3;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuSurfaceFoundation, "strings", {
          get: function () {
              return strings$4;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuSurfaceFoundation, "numbers", {
          get: function () {
              return numbers$2;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuSurfaceFoundation, "Corner", {
          get: function () {
              return Corner;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuSurfaceFoundation, "defaultAdapter", {
          /**
           * @see {@link MDCMenuSurfaceAdapter} for typing information on parameters and return types.
           */
          get: function () {
              // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
              return {
                  addClass: function () { return undefined; },
                  removeClass: function () { return undefined; },
                  hasClass: function () { return false; },
                  hasAnchor: function () { return false; },
                  isElementInContainer: function () { return false; },
                  isFocused: function () { return false; },
                  isRtl: function () { return false; },
                  getInnerDimensions: function () { return ({ height: 0, width: 0 }); },
                  getAnchorDimensions: function () { return null; },
                  getWindowDimensions: function () { return ({ height: 0, width: 0 }); },
                  getBodyDimensions: function () { return ({ height: 0, width: 0 }); },
                  getWindowScroll: function () { return ({ x: 0, y: 0 }); },
                  setPosition: function () { return undefined; },
                  setMaxHeight: function () { return undefined; },
                  setTransformOrigin: function () { return undefined; },
                  saveFocus: function () { return undefined; },
                  restoreFocus: function () { return undefined; },
                  notifyClose: function () { return undefined; },
                  notifyOpen: function () { return undefined; },
              };
              // tslint:enable:object-literal-sort-keys
          },
          enumerable: true,
          configurable: true
      });
      MDCMenuSurfaceFoundation.prototype.init = function () {
          var _a = MDCMenuSurfaceFoundation.cssClasses, ROOT = _a.ROOT, OPEN = _a.OPEN;
          if (!this.adapter_.hasClass(ROOT)) {
              throw new Error(ROOT + " class required in root element.");
          }
          if (this.adapter_.hasClass(OPEN)) {
              this.isOpen_ = true;
          }
      };
      MDCMenuSurfaceFoundation.prototype.destroy = function () {
          clearTimeout(this.openAnimationEndTimerId_);
          clearTimeout(this.closeAnimationEndTimerId_);
          // Cancel any currently running animations.
          cancelAnimationFrame(this.animationRequestId_);
      };
      /**
       * @param corner Default anchor corner alignment of top-left menu surface corner.
       */
      MDCMenuSurfaceFoundation.prototype.setAnchorCorner = function (corner) {
          this.anchorCorner_ = corner;
      };
      /**
       * @param margin Set of margin values from anchor.
       */
      MDCMenuSurfaceFoundation.prototype.setAnchorMargin = function (margin) {
          this.anchorMargin_.top = margin.top || 0;
          this.anchorMargin_.right = margin.right || 0;
          this.anchorMargin_.bottom = margin.bottom || 0;
          this.anchorMargin_.left = margin.left || 0;
      };
      /** Used to indicate if the menu-surface is hoisted to the body. */
      MDCMenuSurfaceFoundation.prototype.setIsHoisted = function (isHoisted) {
          this.isHoistedElement_ = isHoisted;
      };
      /** Used to set the menu-surface calculations based on a fixed position menu. */
      MDCMenuSurfaceFoundation.prototype.setFixedPosition = function (isFixedPosition) {
          this.isFixedPosition_ = isFixedPosition;
      };
      /** Sets the menu-surface position on the page. */
      MDCMenuSurfaceFoundation.prototype.setAbsolutePosition = function (x, y) {
          this.position_.x = this.isFinite_(x) ? x : 0;
          this.position_.y = this.isFinite_(y) ? y : 0;
      };
      MDCMenuSurfaceFoundation.prototype.setQuickOpen = function (quickOpen) {
          this.isQuickOpen_ = quickOpen;
      };
      MDCMenuSurfaceFoundation.prototype.isOpen = function () {
          return this.isOpen_;
      };
      /**
       * Open the menu surface.
       */
      MDCMenuSurfaceFoundation.prototype.open = function () {
          var _this = this;
          this.adapter_.saveFocus();
          if (!this.isQuickOpen_) {
              this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_OPEN);
          }
          this.animationRequestId_ = requestAnimationFrame(function () {
              _this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.OPEN);
              _this.dimensions_ = _this.adapter_.getInnerDimensions();
              _this.autoPosition_();
              if (_this.isQuickOpen_) {
                  _this.adapter_.notifyOpen();
              }
              else {
                  _this.openAnimationEndTimerId_ = setTimeout(function () {
                      _this.openAnimationEndTimerId_ = 0;
                      _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_OPEN);
                      _this.adapter_.notifyOpen();
                  }, numbers$2.TRANSITION_OPEN_DURATION);
              }
          });
          this.isOpen_ = true;
      };
      /**
       * Closes the menu surface.
       */
      MDCMenuSurfaceFoundation.prototype.close = function (skipRestoreFocus) {
          var _this = this;
          if (skipRestoreFocus === void 0) { skipRestoreFocus = false; }
          if (!this.isQuickOpen_) {
              this.adapter_.addClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_CLOSED);
          }
          requestAnimationFrame(function () {
              _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.OPEN);
              if (_this.isQuickOpen_) {
                  _this.adapter_.notifyClose();
              }
              else {
                  _this.closeAnimationEndTimerId_ = setTimeout(function () {
                      _this.closeAnimationEndTimerId_ = 0;
                      _this.adapter_.removeClass(MDCMenuSurfaceFoundation.cssClasses.ANIMATING_CLOSED);
                      _this.adapter_.notifyClose();
                  }, numbers$2.TRANSITION_CLOSE_DURATION);
              }
          });
          this.isOpen_ = false;
          if (!skipRestoreFocus) {
              this.maybeRestoreFocus_();
          }
      };
      /** Handle clicks and close if not within menu-surface element. */
      MDCMenuSurfaceFoundation.prototype.handleBodyClick = function (evt) {
          var el = evt.target;
          if (this.adapter_.isElementInContainer(el)) {
              return;
          }
          this.close();
      };
      /** Handle keys that close the surface. */
      MDCMenuSurfaceFoundation.prototype.handleKeydown = function (evt) {
          var keyCode = evt.keyCode, key = evt.key;
          var isEscape = key === 'Escape' || keyCode === 27;
          if (isEscape) {
              this.close();
          }
      };
      MDCMenuSurfaceFoundation.prototype.autoPosition_ = function () {
          var _a;
          // Compute measurements for autoposition methods reuse.
          this.measurements_ = this.getAutoLayoutMeasurements_();
          var corner = this.getOriginCorner_();
          var maxMenuSurfaceHeight = this.getMenuSurfaceMaxHeight_(corner);
          var verticalAlignment = this.hasBit_(corner, CornerBit.BOTTOM) ? 'bottom' : 'top';
          var horizontalAlignment = this.hasBit_(corner, CornerBit.RIGHT) ? 'right' : 'left';
          var horizontalOffset = this.getHorizontalOriginOffset_(corner);
          var verticalOffset = this.getVerticalOriginOffset_(corner);
          var _b = this.measurements_, anchorSize = _b.anchorSize, surfaceSize = _b.surfaceSize;
          var position = (_a = {},
              _a[horizontalAlignment] = horizontalOffset,
              _a[verticalAlignment] = verticalOffset,
              _a);
          // Center align when anchor width is comparable or greater than menu surface, otherwise keep corner.
          if (anchorSize.width / surfaceSize.width > numbers$2.ANCHOR_TO_MENU_SURFACE_WIDTH_RATIO) {
              horizontalAlignment = 'center';
          }
          // If the menu-surface has been hoisted to the body, it's no longer relative to the anchor element
          if (this.isHoistedElement_ || this.isFixedPosition_) {
              this.adjustPositionForHoistedElement_(position);
          }
          this.adapter_.setTransformOrigin(horizontalAlignment + " " + verticalAlignment);
          this.adapter_.setPosition(position);
          this.adapter_.setMaxHeight(maxMenuSurfaceHeight ? maxMenuSurfaceHeight + 'px' : '');
      };
      /**
       * @return Measurements used to position menu surface popup.
       */
      MDCMenuSurfaceFoundation.prototype.getAutoLayoutMeasurements_ = function () {
          var anchorRect = this.adapter_.getAnchorDimensions();
          var bodySize = this.adapter_.getBodyDimensions();
          var viewportSize = this.adapter_.getWindowDimensions();
          var windowScroll = this.adapter_.getWindowScroll();
          if (!anchorRect) {
              // tslint:disable:object-literal-sort-keys Positional properties are more readable when they're grouped together
              anchorRect = {
                  top: this.position_.y,
                  right: this.position_.x,
                  bottom: this.position_.y,
                  left: this.position_.x,
                  width: 0,
                  height: 0,
              };
              // tslint:enable:object-literal-sort-keys
          }
          return {
              anchorSize: anchorRect,
              bodySize: bodySize,
              surfaceSize: this.dimensions_,
              viewportDistance: {
                  // tslint:disable:object-literal-sort-keys Positional properties are more readable when they're grouped together
                  top: anchorRect.top,
                  right: viewportSize.width - anchorRect.right,
                  bottom: viewportSize.height - anchorRect.bottom,
                  left: anchorRect.left,
              },
              viewportSize: viewportSize,
              windowScroll: windowScroll,
          };
      };
      /**
       * Computes the corner of the anchor from which to animate and position the menu surface.
       */
      MDCMenuSurfaceFoundation.prototype.getOriginCorner_ = function () {
          // Defaults: open from the top left.
          var corner = Corner.TOP_LEFT;
          var _a = this.measurements_, viewportDistance = _a.viewportDistance, anchorSize = _a.anchorSize, surfaceSize = _a.surfaceSize;
          var isBottomAligned = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
          var availableTop = isBottomAligned ? viewportDistance.top + anchorSize.height + this.anchorMargin_.bottom
              : viewportDistance.top + this.anchorMargin_.top;
          var availableBottom = isBottomAligned ? viewportDistance.bottom - this.anchorMargin_.bottom
              : viewportDistance.bottom + anchorSize.height - this.anchorMargin_.top;
          var topOverflow = surfaceSize.height - availableTop;
          var bottomOverflow = surfaceSize.height - availableBottom;
          if (bottomOverflow > 0 && topOverflow < bottomOverflow) {
              corner = this.setBit_(corner, CornerBit.BOTTOM);
          }
          var isRtl = this.adapter_.isRtl();
          var isFlipRtl = this.hasBit_(this.anchorCorner_, CornerBit.FLIP_RTL);
          var avoidHorizontalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.RIGHT);
          var isAlignedRight = (avoidHorizontalOverlap && !isRtl) ||
              (!avoidHorizontalOverlap && isFlipRtl && isRtl);
          var availableLeft = isAlignedRight ? viewportDistance.left + anchorSize.width + this.anchorMargin_.right :
              viewportDistance.left + this.anchorMargin_.left;
          var availableRight = isAlignedRight ? viewportDistance.right - this.anchorMargin_.right :
              viewportDistance.right + anchorSize.width - this.anchorMargin_.left;
          var leftOverflow = surfaceSize.width - availableLeft;
          var rightOverflow = surfaceSize.width - availableRight;
          if ((leftOverflow < 0 && isAlignedRight && isRtl) ||
              (avoidHorizontalOverlap && !isAlignedRight && leftOverflow < 0) ||
              (rightOverflow > 0 && leftOverflow < rightOverflow)) {
              corner = this.setBit_(corner, CornerBit.RIGHT);
          }
          return corner;
      };
      /**
       * @param corner Origin corner of the menu surface.
       * @return Maximum height of the menu surface, based on available space. 0 indicates should not be set.
       */
      MDCMenuSurfaceFoundation.prototype.getMenuSurfaceMaxHeight_ = function (corner) {
          var viewportDistance = this.measurements_.viewportDistance;
          var maxHeight = 0;
          var isBottomAligned = this.hasBit_(corner, CornerBit.BOTTOM);
          var isBottomAnchored = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
          var MARGIN_TO_EDGE = MDCMenuSurfaceFoundation.numbers.MARGIN_TO_EDGE;
          // When maximum height is not specified, it is handled from CSS.
          if (isBottomAligned) {
              maxHeight = viewportDistance.top + this.anchorMargin_.top - MARGIN_TO_EDGE;
              if (!isBottomAnchored) {
                  maxHeight += this.measurements_.anchorSize.height;
              }
          }
          else {
              maxHeight =
                  viewportDistance.bottom - this.anchorMargin_.bottom + this.measurements_.anchorSize.height - MARGIN_TO_EDGE;
              if (isBottomAnchored) {
                  maxHeight -= this.measurements_.anchorSize.height;
              }
          }
          return maxHeight;
      };
      /**
       * @param corner Origin corner of the menu surface.
       * @return Horizontal offset of menu surface origin corner from corresponding anchor corner.
       */
      MDCMenuSurfaceFoundation.prototype.getHorizontalOriginOffset_ = function (corner) {
          var anchorSize = this.measurements_.anchorSize;
          // isRightAligned corresponds to using the 'right' property on the surface.
          var isRightAligned = this.hasBit_(corner, CornerBit.RIGHT);
          var avoidHorizontalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.RIGHT);
          if (isRightAligned) {
              var rightOffset = avoidHorizontalOverlap ? anchorSize.width - this.anchorMargin_.left : this.anchorMargin_.right;
              // For hoisted or fixed elements, adjust the offset by the difference between viewport width and body width so
              // when we calculate the right value (`adjustPositionForHoistedElement_`) based on the element position,
              // the right property is correct.
              if (this.isHoistedElement_ || this.isFixedPosition_) {
                  return rightOffset - (this.measurements_.viewportSize.width - this.measurements_.bodySize.width);
              }
              return rightOffset;
          }
          return avoidHorizontalOverlap ? anchorSize.width - this.anchorMargin_.right : this.anchorMargin_.left;
      };
      /**
       * @param corner Origin corner of the menu surface.
       * @return Vertical offset of menu surface origin corner from corresponding anchor corner.
       */
      MDCMenuSurfaceFoundation.prototype.getVerticalOriginOffset_ = function (corner) {
          var anchorSize = this.measurements_.anchorSize;
          var isBottomAligned = this.hasBit_(corner, CornerBit.BOTTOM);
          var avoidVerticalOverlap = this.hasBit_(this.anchorCorner_, CornerBit.BOTTOM);
          var y = 0;
          if (isBottomAligned) {
              y = avoidVerticalOverlap ? anchorSize.height - this.anchorMargin_.top : -this.anchorMargin_.bottom;
          }
          else {
              y = avoidVerticalOverlap ? (anchorSize.height + this.anchorMargin_.bottom) : this.anchorMargin_.top;
          }
          return y;
      };
      /** Calculates the offsets for positioning the menu-surface when the menu-surface has been hoisted to the body. */
      MDCMenuSurfaceFoundation.prototype.adjustPositionForHoistedElement_ = function (position) {
          var e_1, _a;
          var _b = this.measurements_, windowScroll = _b.windowScroll, viewportDistance = _b.viewportDistance;
          var props = Object.keys(position);
          try {
              for (var props_1 = __values(props), props_1_1 = props_1.next(); !props_1_1.done; props_1_1 = props_1.next()) {
                  var prop = props_1_1.value;
                  var value = position[prop] || 0;
                  // Hoisted surfaces need to have the anchor elements location on the page added to the
                  // position properties for proper alignment on the body.
                  value += viewportDistance[prop];
                  // Surfaces that are absolutely positioned need to have additional calculations for scroll
                  // and bottom positioning.
                  if (!this.isFixedPosition_) {
                      if (prop === 'top') {
                          value += windowScroll.y;
                      }
                      else if (prop === 'bottom') {
                          value -= windowScroll.y;
                      }
                      else if (prop === 'left') {
                          value += windowScroll.x;
                      }
                      else { // prop === 'right'
                          value -= windowScroll.x;
                      }
                  }
                  position[prop] = value;
              }
          }
          catch (e_1_1) { e_1 = { error: e_1_1 }; }
          finally {
              try {
                  if (props_1_1 && !props_1_1.done && (_a = props_1.return)) _a.call(props_1);
              }
              finally { if (e_1) throw e_1.error; }
          }
      };
      /**
       * The last focused element when the menu surface was opened should regain focus, if the user is
       * focused on or within the menu surface when it is closed.
       */
      MDCMenuSurfaceFoundation.prototype.maybeRestoreFocus_ = function () {
          var isRootFocused = this.adapter_.isFocused();
          var childHasFocus = document.activeElement && this.adapter_.isElementInContainer(document.activeElement);
          if (isRootFocused || childHasFocus) {
              this.adapter_.restoreFocus();
          }
      };
      MDCMenuSurfaceFoundation.prototype.hasBit_ = function (corner, bit) {
          return Boolean(corner & bit); // tslint:disable-line:no-bitwise
      };
      MDCMenuSurfaceFoundation.prototype.setBit_ = function (corner, bit) {
          return corner | bit; // tslint:disable-line:no-bitwise
      };
      /**
       * isFinite that doesn't force conversion to number type.
       * Equivalent to Number.isFinite in ES2015, which is not supported in IE.
       */
      MDCMenuSurfaceFoundation.prototype.isFinite_ = function (num) {
          return typeof num === 'number' && isFinite(num);
      };
      return MDCMenuSurfaceFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cachedCssTransformPropertyName_;
  /**
   * Returns the name of the correct transform property to use on the current browser.
   */
  function getTransformPropertyName(globalObj, forceRefresh) {
      if (forceRefresh === void 0) { forceRefresh = false; }
      if (cachedCssTransformPropertyName_ === undefined || forceRefresh) {
          var el = globalObj.document.createElement('div');
          cachedCssTransformPropertyName_ = 'transform' in el.style ? 'transform' : 'webkitTransform';
      }
      return cachedCssTransformPropertyName_;
  }
  //# sourceMappingURL=util.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCMenuSurface = /** @class */ (function (_super) {
      __extends(MDCMenuSurface, _super);
      function MDCMenuSurface() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      MDCMenuSurface.attachTo = function (root) {
          return new MDCMenuSurface(root);
      };
      MDCMenuSurface.prototype.initialSyncWithDOM = function () {
          var _this = this;
          var parentEl = this.root_.parentElement;
          this.anchorElement = parentEl && parentEl.classList.contains(cssClasses$3.ANCHOR) ? parentEl : null;
          if (this.root_.classList.contains(cssClasses$3.FIXED)) {
              this.setFixedPosition(true);
          }
          this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
          this.handleBodyClick_ = function (evt) { return _this.foundation_.handleBodyClick(evt); };
          this.registerBodyClickListener_ = function () { return document.body.addEventListener('click', _this.handleBodyClick_); };
          this.deregisterBodyClickListener_ = function () { return document.body.removeEventListener('click', _this.handleBodyClick_); };
          this.listen('keydown', this.handleKeydown_);
          this.listen(strings$4.OPENED_EVENT, this.registerBodyClickListener_);
          this.listen(strings$4.CLOSED_EVENT, this.deregisterBodyClickListener_);
      };
      MDCMenuSurface.prototype.destroy = function () {
          this.unlisten('keydown', this.handleKeydown_);
          this.unlisten(strings$4.OPENED_EVENT, this.registerBodyClickListener_);
          this.unlisten(strings$4.CLOSED_EVENT, this.deregisterBodyClickListener_);
          _super.prototype.destroy.call(this);
      };
      MDCMenuSurface.prototype.isOpen = function () {
          return this.foundation_.isOpen();
      };
      MDCMenuSurface.prototype.open = function () {
          this.foundation_.open();
      };
      MDCMenuSurface.prototype.close = function (skipRestoreFocus) {
          if (skipRestoreFocus === void 0) { skipRestoreFocus = false; }
          this.foundation_.close(skipRestoreFocus);
      };
      Object.defineProperty(MDCMenuSurface.prototype, "quickOpen", {
          set: function (quickOpen) {
              this.foundation_.setQuickOpen(quickOpen);
          },
          enumerable: true,
          configurable: true
      });
      /**
       * Removes the menu-surface from it's current location and appends it to the
       * body to overcome any overflow:hidden issues.
       */
      MDCMenuSurface.prototype.hoistMenuToBody = function () {
          document.body.appendChild(this.root_);
          this.setIsHoisted(true);
      };
      /** Sets the foundation to use page offsets for an positioning when the menu is hoisted to the body. */
      MDCMenuSurface.prototype.setIsHoisted = function (isHoisted) {
          this.foundation_.setIsHoisted(isHoisted);
      };
      /** Sets the element that the menu-surface is anchored to. */
      MDCMenuSurface.prototype.setMenuSurfaceAnchorElement = function (element) {
          this.anchorElement = element;
      };
      /** Sets the menu-surface to position: fixed. */
      MDCMenuSurface.prototype.setFixedPosition = function (isFixed) {
          if (isFixed) {
              this.root_.classList.add(cssClasses$3.FIXED);
          }
          else {
              this.root_.classList.remove(cssClasses$3.FIXED);
          }
          this.foundation_.setFixedPosition(isFixed);
      };
      /** Sets the absolute x/y position to position based on. Requires the menu to be hoisted. */
      MDCMenuSurface.prototype.setAbsolutePosition = function (x, y) {
          this.foundation_.setAbsolutePosition(x, y);
          this.setIsHoisted(true);
      };
      /**
       * @param corner Default anchor corner alignment of top-left surface corner.
       */
      MDCMenuSurface.prototype.setAnchorCorner = function (corner) {
          this.foundation_.setAnchorCorner(corner);
      };
      MDCMenuSurface.prototype.setAnchorMargin = function (margin) {
          this.foundation_.setAnchorMargin(margin);
      };
      MDCMenuSurface.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
          var adapter = {
              addClass: function (className) { return _this.root_.classList.add(className); },
              removeClass: function (className) { return _this.root_.classList.remove(className); },
              hasClass: function (className) { return _this.root_.classList.contains(className); },
              hasAnchor: function () { return !!_this.anchorElement; },
              notifyClose: function () { return _this.emit(MDCMenuSurfaceFoundation.strings.CLOSED_EVENT, {}); },
              notifyOpen: function () { return _this.emit(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, {}); },
              isElementInContainer: function (el) { return _this.root_.contains(el); },
              isRtl: function () { return getComputedStyle(_this.root_).getPropertyValue('direction') === 'rtl'; },
              setTransformOrigin: function (origin) {
                  var propertyName = getTransformPropertyName(window) + "-origin";
                  _this.root_.style.setProperty(propertyName, origin);
              },
              isFocused: function () { return document.activeElement === _this.root_; },
              saveFocus: function () {
                  _this.previousFocus_ = document.activeElement;
              },
              restoreFocus: function () {
                  if (_this.root_.contains(document.activeElement)) {
                      if (_this.previousFocus_ && _this.previousFocus_.focus) {
                          _this.previousFocus_.focus();
                      }
                  }
              },
              getInnerDimensions: function () {
                  return { width: _this.root_.offsetWidth, height: _this.root_.offsetHeight };
              },
              getAnchorDimensions: function () { return _this.anchorElement ? _this.anchorElement.getBoundingClientRect() : null; },
              getWindowDimensions: function () {
                  return { width: window.innerWidth, height: window.innerHeight };
              },
              getBodyDimensions: function () {
                  return { width: document.body.clientWidth, height: document.body.clientHeight };
              },
              getWindowScroll: function () {
                  return { x: window.pageXOffset, y: window.pageYOffset };
              },
              setPosition: function (position) {
                  _this.root_.style.left = 'left' in position ? position.left + "px" : '';
                  _this.root_.style.right = 'right' in position ? position.right + "px" : '';
                  _this.root_.style.top = 'top' in position ? position.top + "px" : '';
                  _this.root_.style.bottom = 'bottom' in position ? position.bottom + "px" : '';
              },
              setMaxHeight: function (height) {
                  _this.root_.style.maxHeight = height;
              },
          };
          // tslint:enable:object-literal-sort-keys
          return new MDCMenuSurfaceFoundation(adapter);
      };
      return MDCMenuSurface;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$5 = {
      MENU_SELECTED_LIST_ITEM: 'mdc-menu-item--selected',
      MENU_SELECTION_GROUP: 'mdc-menu__selection-group',
      ROOT: 'mdc-menu',
  };
  var strings$6 = {
      ARIA_CHECKED_ATTR: 'aria-checked',
      ARIA_DISABLED_ATTR: 'aria-disabled',
      CHECKBOX_SELECTOR: 'input[type="checkbox"]',
      LIST_SELECTOR: '.mdc-list',
      SELECTED_EVENT: 'MDCMenu:selected',
  };
  var numbers$4 = {
      FOCUS_ROOT_INDEX: -1,
  };
  var DefaultFocusState;
  (function (DefaultFocusState) {
      DefaultFocusState[DefaultFocusState["NONE"] = 0] = "NONE";
      DefaultFocusState[DefaultFocusState["LIST_ROOT"] = 1] = "LIST_ROOT";
      DefaultFocusState[DefaultFocusState["FIRST_ITEM"] = 2] = "FIRST_ITEM";
      DefaultFocusState[DefaultFocusState["LAST_ITEM"] = 3] = "LAST_ITEM";
  })(DefaultFocusState || (DefaultFocusState = {}));
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCMenuFoundation = /** @class */ (function (_super) {
      __extends(MDCMenuFoundation, _super);
      function MDCMenuFoundation(adapter) {
          var _this = _super.call(this, __assign({}, MDCMenuFoundation.defaultAdapter, adapter)) || this;
          _this.closeAnimationEndTimerId_ = 0;
          _this.defaultFocusState_ = DefaultFocusState.LIST_ROOT;
          return _this;
      }
      Object.defineProperty(MDCMenuFoundation, "cssClasses", {
          get: function () {
              return cssClasses$5;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuFoundation, "strings", {
          get: function () {
              return strings$6;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuFoundation, "numbers", {
          get: function () {
              return numbers$4;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenuFoundation, "defaultAdapter", {
          /**
           * @see {@link MDCMenuAdapter} for typing information on parameters and return types.
           */
          get: function () {
              // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
              return {
                  addClassToElementAtIndex: function () { return undefined; },
                  removeClassFromElementAtIndex: function () { return undefined; },
                  addAttributeToElementAtIndex: function () { return undefined; },
                  removeAttributeFromElementAtIndex: function () { return undefined; },
                  elementContainsClass: function () { return false; },
                  closeSurface: function () { return undefined; },
                  getElementIndex: function () { return -1; },
                  notifySelected: function () { return undefined; },
                  getMenuItemCount: function () { return 0; },
                  focusItemAtIndex: function () { return undefined; },
                  focusListRoot: function () { return undefined; },
                  getSelectedSiblingOfItemAtIndex: function () { return -1; },
                  isSelectableItemAtIndex: function () { return false; },
              };
              // tslint:enable:object-literal-sort-keys
          },
          enumerable: true,
          configurable: true
      });
      MDCMenuFoundation.prototype.destroy = function () {
          if (this.closeAnimationEndTimerId_) {
              clearTimeout(this.closeAnimationEndTimerId_);
          }
          this.adapter_.closeSurface();
      };
      MDCMenuFoundation.prototype.handleKeydown = function (evt) {
          var key = evt.key, keyCode = evt.keyCode;
          var isTab = key === 'Tab' || keyCode === 9;
          if (isTab) {
              this.adapter_.closeSurface(/** skipRestoreFocus */ true);
          }
      };
      MDCMenuFoundation.prototype.handleItemAction = function (listItem) {
          var _this = this;
          var index = this.adapter_.getElementIndex(listItem);
          if (index < 0) {
              return;
          }
          this.adapter_.notifySelected({ index: index });
          this.adapter_.closeSurface();
          // Wait for the menu to close before adding/removing classes that affect styles.
          this.closeAnimationEndTimerId_ = setTimeout(function () {
              // Recompute the index in case the menu contents have changed.
              var recomputedIndex = _this.adapter_.getElementIndex(listItem);
              if (_this.adapter_.isSelectableItemAtIndex(recomputedIndex)) {
                  _this.setSelectedIndex(recomputedIndex);
              }
          }, MDCMenuSurfaceFoundation.numbers.TRANSITION_CLOSE_DURATION);
      };
      MDCMenuFoundation.prototype.handleMenuSurfaceOpened = function () {
          switch (this.defaultFocusState_) {
              case DefaultFocusState.FIRST_ITEM:
                  this.adapter_.focusItemAtIndex(0);
                  break;
              case DefaultFocusState.LAST_ITEM:
                  this.adapter_.focusItemAtIndex(this.adapter_.getMenuItemCount() - 1);
                  break;
              case DefaultFocusState.NONE:
                  // Do nothing.
                  break;
              default:
                  this.adapter_.focusListRoot();
                  break;
          }
      };
      /**
       * Sets default focus state where the menu should focus every time when menu
       * is opened. Focuses the list root (`DefaultFocusState.LIST_ROOT`) element by
       * default.
       */
      MDCMenuFoundation.prototype.setDefaultFocusState = function (focusState) {
          this.defaultFocusState_ = focusState;
      };
      /**
       * Selects the list item at `index` within the menu.
       * @param index Index of list item within the menu.
       */
      MDCMenuFoundation.prototype.setSelectedIndex = function (index) {
          this.validatedIndex_(index);
          if (!this.adapter_.isSelectableItemAtIndex(index)) {
              throw new Error('MDCMenuFoundation: No selection group at specified index.');
          }
          var prevSelectedIndex = this.adapter_.getSelectedSiblingOfItemAtIndex(index);
          if (prevSelectedIndex >= 0) {
              this.adapter_.removeAttributeFromElementAtIndex(prevSelectedIndex, strings$6.ARIA_CHECKED_ATTR);
              this.adapter_.removeClassFromElementAtIndex(prevSelectedIndex, cssClasses$5.MENU_SELECTED_LIST_ITEM);
          }
          this.adapter_.addClassToElementAtIndex(index, cssClasses$5.MENU_SELECTED_LIST_ITEM);
          this.adapter_.addAttributeToElementAtIndex(index, strings$6.ARIA_CHECKED_ATTR, 'true');
      };
      /**
       * Sets the enabled state to isEnabled for the menu item at the given index.
       * @param index Index of the menu item
       * @param isEnabled The desired enabled state of the menu item.
       */
      MDCMenuFoundation.prototype.setEnabled = function (index, isEnabled) {
          this.validatedIndex_(index);
          if (isEnabled) {
              this.adapter_.removeClassFromElementAtIndex(index, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
              this.adapter_.addAttributeToElementAtIndex(index, strings$6.ARIA_DISABLED_ATTR, 'false');
          }
          else {
              this.adapter_.addClassToElementAtIndex(index, cssClasses$4.LIST_ITEM_DISABLED_CLASS);
              this.adapter_.addAttributeToElementAtIndex(index, strings$6.ARIA_DISABLED_ATTR, 'true');
          }
      };
      MDCMenuFoundation.prototype.validatedIndex_ = function (index) {
          var menuSize = this.adapter_.getMenuItemCount();
          var isIndexInRange = index >= 0 && index < menuSize;
          if (!isIndexInRange) {
              throw new Error('MDCMenuFoundation: No list item at specified index.');
          }
      };
      return MDCMenuFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCMenu = /** @class */ (function (_super) {
      __extends(MDCMenu, _super);
      function MDCMenu() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      MDCMenu.attachTo = function (root) {
          return new MDCMenu(root);
      };
      MDCMenu.prototype.initialize = function (menuSurfaceFactory, listFactory) {
          if (menuSurfaceFactory === void 0) { menuSurfaceFactory = function (el) { return new MDCMenuSurface(el); }; }
          if (listFactory === void 0) { listFactory = function (el) { return new MDCList(el); }; }
          this.menuSurfaceFactory_ = menuSurfaceFactory;
          this.listFactory_ = listFactory;
      };
      MDCMenu.prototype.initialSyncWithDOM = function () {
          var _this = this;
          this.menuSurface_ = this.menuSurfaceFactory_(this.root_);
          var list = this.root_.querySelector(strings$6.LIST_SELECTOR);
          if (list) {
              this.list_ = this.listFactory_(list);
              this.list_.wrapFocus = true;
          }
          else {
              this.list_ = null;
          }
          this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
          this.handleItemAction_ = function (evt) { return _this.foundation_.handleItemAction(_this.items[evt.detail.index]); };
          this.handleMenuSurfaceOpened_ = function () { return _this.foundation_.handleMenuSurfaceOpened(); };
          this.menuSurface_.listen(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, this.handleMenuSurfaceOpened_);
          this.listen('keydown', this.handleKeydown_);
          this.listen(MDCListFoundation.strings.ACTION_EVENT, this.handleItemAction_);
      };
      MDCMenu.prototype.destroy = function () {
          if (this.list_) {
              this.list_.destroy();
          }
          this.menuSurface_.destroy();
          this.menuSurface_.unlisten(MDCMenuSurfaceFoundation.strings.OPENED_EVENT, this.handleMenuSurfaceOpened_);
          this.unlisten('keydown', this.handleKeydown_);
          this.unlisten(MDCListFoundation.strings.ACTION_EVENT, this.handleItemAction_);
          _super.prototype.destroy.call(this);
      };
      Object.defineProperty(MDCMenu.prototype, "open", {
          get: function () {
              return this.menuSurface_.isOpen();
          },
          set: function (value) {
              if (value) {
                  this.menuSurface_.open();
              }
              else {
                  this.menuSurface_.close();
              }
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenu.prototype, "wrapFocus", {
          get: function () {
              return this.list_ ? this.list_.wrapFocus : false;
          },
          set: function (value) {
              if (this.list_) {
                  this.list_.wrapFocus = value;
              }
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenu.prototype, "items", {
          /**
           * Return the items within the menu. Note that this only contains the set of elements within
           * the items container that are proper list items, and not supplemental / presentational DOM
           * elements.
           */
          get: function () {
              return this.list_ ? this.list_.listElements : [];
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCMenu.prototype, "quickOpen", {
          set: function (quickOpen) {
              this.menuSurface_.quickOpen = quickOpen;
          },
          enumerable: true,
          configurable: true
      });
      /**
       * Sets default focus state where the menu should focus every time when menu
       * is opened. Focuses the list root (`DefaultFocusState.LIST_ROOT`) element by
       * default.
       * @param focusState Default focus state.
       */
      MDCMenu.prototype.setDefaultFocusState = function (focusState) {
          this.foundation_.setDefaultFocusState(focusState);
      };
      /**
       * @param corner Default anchor corner alignment of top-left menu corner.
       */
      MDCMenu.prototype.setAnchorCorner = function (corner) {
          this.menuSurface_.setAnchorCorner(corner);
      };
      MDCMenu.prototype.setAnchorMargin = function (margin) {
          this.menuSurface_.setAnchorMargin(margin);
      };
      /**
       * Sets the list item as the selected row at the specified index.
       * @param index Index of list item within menu.
       */
      MDCMenu.prototype.setSelectedIndex = function (index) {
          this.foundation_.setSelectedIndex(index);
      };
      /**
       * Sets the enabled state to isEnabled for the menu item at the given index.
       * @param index Index of the menu item
       * @param isEnabled The desired enabled state of the menu item.
       */
      MDCMenu.prototype.setEnabled = function (index, isEnabled) {
          this.foundation_.setEnabled(index, isEnabled);
      };
      /**
       * @return The item within the menu at the index specified.
       */
      MDCMenu.prototype.getOptionByIndex = function (index) {
          var items = this.items;
          if (index < items.length) {
              return this.items[index];
          }
          else {
              return null;
          }
      };
      MDCMenu.prototype.setFixedPosition = function (isFixed) {
          this.menuSurface_.setFixedPosition(isFixed);
      };
      MDCMenu.prototype.hoistMenuToBody = function () {
          this.menuSurface_.hoistMenuToBody();
      };
      MDCMenu.prototype.setIsHoisted = function (isHoisted) {
          this.menuSurface_.setIsHoisted(isHoisted);
      };
      MDCMenu.prototype.setAbsolutePosition = function (x, y) {
          this.menuSurface_.setAbsolutePosition(x, y);
      };
      /**
       * Sets the element that the menu-surface is anchored to.
       */
      MDCMenu.prototype.setAnchorElement = function (element) {
          this.menuSurface_.anchorElement = element;
      };
      MDCMenu.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
          var adapter = {
              addClassToElementAtIndex: function (index, className) {
                  var list = _this.items;
                  list[index].classList.add(className);
              },
              removeClassFromElementAtIndex: function (index, className) {
                  var list = _this.items;
                  list[index].classList.remove(className);
              },
              addAttributeToElementAtIndex: function (index, attr, value) {
                  var list = _this.items;
                  list[index].setAttribute(attr, value);
              },
              removeAttributeFromElementAtIndex: function (index, attr) {
                  var list = _this.items;
                  list[index].removeAttribute(attr);
              },
              elementContainsClass: function (element, className) { return element.classList.contains(className); },
              closeSurface: function (skipRestoreFocus) { return _this.menuSurface_.close(skipRestoreFocus); },
              getElementIndex: function (element) { return _this.items.indexOf(element); },
              notifySelected: function (evtData) { return _this.emit(strings$6.SELECTED_EVENT, {
                  index: evtData.index,
                  item: _this.items[evtData.index],
              }); },
              getMenuItemCount: function () { return _this.items.length; },
              focusItemAtIndex: function (index) { return _this.items[index].focus(); },
              focusListRoot: function () { return _this.root_.querySelector(strings$6.LIST_SELECTOR).focus(); },
              isSelectableItemAtIndex: function (index) { return !!closest(_this.items[index], "." + cssClasses$5.MENU_SELECTION_GROUP); },
              getSelectedSiblingOfItemAtIndex: function (index) {
                  var selectionGroupEl = closest(_this.items[index], "." + cssClasses$5.MENU_SELECTION_GROUP);
                  var selectedItemEl = selectionGroupEl.querySelector("." + cssClasses$5.MENU_SELECTED_LIST_ITEM);
                  return selectedItemEl ? _this.items.indexOf(selectedItemEl) : -1;
              },
          };
          // tslint:enable:object-literal-sort-keys
          return new MDCMenuFoundation(adapter);
      };
      return MDCMenu;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  /* node_modules/@smui/menu-surface/MenuSurface.svelte generated by Svelte v3.16.7 */
  const file$6 = "node_modules/@smui/menu-surface/MenuSurface.svelte";

  function create_fragment$7(ctx) {
  	let div;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[27].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[26], null);

  	let div_levels = [
  		{
  			class: "\n    mdc-menu-surface\n    " + /*className*/ ctx[3] + "\n    " + (/*fixed*/ ctx[0] ? "mdc-menu-surface--fixed" : "") + "\n    " + (/*isStatic*/ ctx[4] ? "mdc-menu-surface--open" : "") + "\n    " + (/*isStatic*/ ctx[4] ? "smui-menu-surface--static" : "") + "\n  "
  		},
  		exclude(/*$$props*/ ctx[7], [
  			"use",
  			"class",
  			"static",
  			"anchor",
  			"fixed",
  			"open",
  			"quickOpen",
  			"anchorElement",
  			"anchorCorner",
  			"element"
  		])
  	];

  	let div_data = {};

  	for (let i = 0; i < div_levels.length; i += 1) {
  		div_data = assign(div_data, div_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			div = element("div");
  			if (default_slot) default_slot.c();
  			set_attributes(div, div_data);
  			add_location(div, file$6, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[2])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[5].call(null, div)),
  				listen_dev(div, "MDCMenuSurface:closed", /*updateOpen*/ ctx[6], false, false, false),
  				listen_dev(div, "MDCMenuSurface:opened", /*updateOpen*/ ctx[6], false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div, anchor);

  			if (default_slot) {
  				default_slot.m(div, null);
  			}

  			/*div_binding*/ ctx[28](div);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 67108864) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[26], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[26], dirty, null));
  			}

  			set_attributes(div, get_spread_update(div_levels, [
  				dirty & /*className, fixed, isStatic*/ 25 && ({
  					class: "\n    mdc-menu-surface\n    " + /*className*/ ctx[3] + "\n    " + (/*fixed*/ ctx[0] ? "mdc-menu-surface--fixed" : "") + "\n    " + (/*isStatic*/ ctx[4] ? "mdc-menu-surface--open" : "") + "\n    " + (/*isStatic*/ ctx[4] ? "smui-menu-surface--static" : "") + "\n  "
  				}),
  				dirty & /*exclude, $$props*/ 128 && exclude(/*$$props*/ ctx[7], [
  					"use",
  					"class",
  					"static",
  					"anchor",
  					"fixed",
  					"open",
  					"quickOpen",
  					"anchorElement",
  					"anchorCorner",
  					"element"
  				])
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 4) useActions_action.update.call(null, /*use*/ ctx[2]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div);
  			if (default_slot) default_slot.d(detaching);
  			/*div_binding*/ ctx[28](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$7.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$7($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCMenuSurface:closed", "MDCMenuSurface:opened"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { static: isStatic = false } = $$props;
  	let { anchor = true } = $$props;
  	let { fixed = false } = $$props;
  	let { open = isStatic } = $$props;
  	let { quickOpen = false } = $$props;
  	let { anchorElement = null } = $$props;
  	let { anchorCorner = null } = $$props;
  	let { element = undefined } = $$props;
  	let menuSurface;
  	let instantiate = getContext("SMUI:menu-surface:instantiate");
  	let getInstance = getContext("SMUI:menu-surface:getInstance");
  	setContext("SMUI:list:role", "menu");
  	setContext("SMUI:list:item:role", "menuitem");
  	let oldFixed = null;

  	onMount(async () => {
  		if (instantiate !== false) {
  			$$invalidate(22, menuSurface = new MDCMenuSurface(element));
  		} else {
  			$$invalidate(22, menuSurface = await getInstance());
  		}
  	});

  	onDestroy(() => {
  		if (anchor) {
  			element && element.parentNode.classList.remove("mdc-menu-surface--anchor");
  		}

  		let isHoisted = false;

  		if (menuSurface) {
  			isHoisted = menuSurface.foundation_.isHoistedElement_;
  		}

  		if (instantiate !== false) {
  			menuSurface.destroy();
  		}

  		if (isHoisted) {
  			element.parentNode.removeChild(element);
  		}
  	});

  	function updateOpen() {
  		if (menuSurface) {
  			if (isStatic) {
  				$$invalidate(8, open = true);
  			} else {
  				$$invalidate(8, open = menuSurface.isOpen());
  			}
  		}
  	}

  	function setOpen(value) {
  		$$invalidate(8, open = value);
  	}

  	function setAnchorCorner(...args) {
  		return menuSurface.setAnchorCorner(...args);
  	}

  	function setAnchorMargin(...args) {
  		return menuSurface.setAnchorMargin(...args);
  	}

  	function setFixedPosition(isFixed, ...args) {
  		$$invalidate(0, fixed = isFixed);
  		return menuSurface.setFixedPosition(isFixed, ...args);
  	}

  	function setAbsolutePosition(...args) {
  		return menuSurface.setAbsolutePosition(...args);
  	}

  	function setMenuSurfaceAnchorElement(...args) {
  		return menuSurface.setMenuSurfaceAnchorElement(...args);
  	}

  	function hoistMenuToBody(...args) {
  		return menuSurface.hoistMenuToBody(...args);
  	}

  	function setIsHoisted(...args) {
  		return menuSurface.setIsHoisted(...args);
  	}

  	function getDefaultFoundation(...args) {
  		return menuSurface.getDefaultFoundation(...args);
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function div_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(1, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(7, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(2, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(3, className = $$new_props.class);
  		if ("static" in $$new_props) $$invalidate(4, isStatic = $$new_props.static);
  		if ("anchor" in $$new_props) $$invalidate(10, anchor = $$new_props.anchor);
  		if ("fixed" in $$new_props) $$invalidate(0, fixed = $$new_props.fixed);
  		if ("open" in $$new_props) $$invalidate(8, open = $$new_props.open);
  		if ("quickOpen" in $$new_props) $$invalidate(11, quickOpen = $$new_props.quickOpen);
  		if ("anchorElement" in $$new_props) $$invalidate(9, anchorElement = $$new_props.anchorElement);
  		if ("anchorCorner" in $$new_props) $$invalidate(12, anchorCorner = $$new_props.anchorCorner);
  		if ("element" in $$new_props) $$invalidate(1, element = $$new_props.element);
  		if ("$$scope" in $$new_props) $$invalidate(26, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			isStatic,
  			anchor,
  			fixed,
  			open,
  			quickOpen,
  			anchorElement,
  			anchorCorner,
  			element,
  			menuSurface,
  			instantiate,
  			getInstance,
  			oldFixed
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(7, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(2, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(3, className = $$new_props.className);
  		if ("isStatic" in $$props) $$invalidate(4, isStatic = $$new_props.isStatic);
  		if ("anchor" in $$props) $$invalidate(10, anchor = $$new_props.anchor);
  		if ("fixed" in $$props) $$invalidate(0, fixed = $$new_props.fixed);
  		if ("open" in $$props) $$invalidate(8, open = $$new_props.open);
  		if ("quickOpen" in $$props) $$invalidate(11, quickOpen = $$new_props.quickOpen);
  		if ("anchorElement" in $$props) $$invalidate(9, anchorElement = $$new_props.anchorElement);
  		if ("anchorCorner" in $$props) $$invalidate(12, anchorCorner = $$new_props.anchorCorner);
  		if ("element" in $$props) $$invalidate(1, element = $$new_props.element);
  		if ("menuSurface" in $$props) $$invalidate(22, menuSurface = $$new_props.menuSurface);
  		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
  		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
  		if ("oldFixed" in $$props) $$invalidate(23, oldFixed = $$new_props.oldFixed);
  	};

  	$$self.$$.update = () => {
  		if ($$self.$$.dirty & /*element, anchor*/ 1026) {
  			 if (element && anchor && !element.parentNode.classList.contains("mdc-menu-surface--anchor")) {
  				element.parentNode.classList.add("mdc-menu-surface--anchor");
  				$$invalidate(9, anchorElement = element.parentNode);
  			}
  		}

  		if ($$self.$$.dirty & /*menuSurface, quickOpen*/ 4196352) {
  			 if (menuSurface && menuSurface.quickOpen !== quickOpen) {
  				$$invalidate(22, menuSurface.quickOpen = quickOpen, menuSurface);
  			}
  		}

  		if ($$self.$$.dirty & /*menuSurface, anchorElement*/ 4194816) {
  			 if (menuSurface && menuSurface.anchorElement !== anchorElement) {
  				$$invalidate(22, menuSurface.anchorElement = anchorElement, menuSurface);
  			}
  		}

  		if ($$self.$$.dirty & /*menuSurface, open*/ 4194560) {
  			 if (menuSurface && menuSurface.isOpen() !== open) {
  				if (open) {
  					menuSurface.open();
  				} else {
  					menuSurface.close();
  				}
  			}
  		}

  		if ($$self.$$.dirty & /*menuSurface, oldFixed, fixed*/ 12582913) {
  			 if (menuSurface && oldFixed !== fixed) {
  				menuSurface.setFixedPosition(fixed);
  				$$invalidate(23, oldFixed = fixed);
  			}
  		}

  		if ($$self.$$.dirty & /*menuSurface, anchorCorner*/ 4198400) {
  			 if (menuSurface && anchorCorner != null) {
  				if (Corner.hasOwnProperty(anchorCorner)) {
  					menuSurface.setAnchorCorner(Corner[anchorCorner]);
  				} else if (CornerBit.hasOwnProperty(anchorCorner)) {
  					menuSurface.setAnchorCorner(Corner[anchorCorner]);
  				} else {
  					menuSurface.setAnchorCorner(anchorCorner);
  				}
  			}
  		}
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		fixed,
  		element,
  		use,
  		className,
  		isStatic,
  		forwardEvents,
  		updateOpen,
  		$$props,
  		open,
  		anchorElement,
  		anchor,
  		quickOpen,
  		anchorCorner,
  		setOpen,
  		setAnchorCorner,
  		setAnchorMargin,
  		setFixedPosition,
  		setAbsolutePosition,
  		setMenuSurfaceAnchorElement,
  		hoistMenuToBody,
  		setIsHoisted,
  		getDefaultFoundation,
  		menuSurface,
  		oldFixed,
  		instantiate,
  		getInstance,
  		$$scope,
  		$$slots,
  		div_binding
  	];
  }

  class MenuSurface extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
  			use: 2,
  			class: 3,
  			static: 4,
  			anchor: 10,
  			fixed: 0,
  			open: 8,
  			quickOpen: 11,
  			anchorElement: 9,
  			anchorCorner: 12,
  			element: 1,
  			setOpen: 13,
  			setAnchorCorner: 14,
  			setAnchorMargin: 15,
  			setFixedPosition: 16,
  			setAbsolutePosition: 17,
  			setMenuSurfaceAnchorElement: 18,
  			hoistMenuToBody: 19,
  			setIsHoisted: 20,
  			getDefaultFoundation: 21
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "MenuSurface",
  			options,
  			id: create_fragment$7.name
  		});
  	}

  	get use() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get static() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set static(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get anchor() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set anchor(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get fixed() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set fixed(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get open() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set open(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get quickOpen() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set quickOpen(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get anchorElement() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set anchorElement(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get anchorCorner() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set anchorCorner(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get element() {
  		throw new Error("<MenuSurface>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set element(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setOpen() {
  		return this.$$.ctx[13];
  	}

  	set setOpen(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAnchorCorner() {
  		return this.$$.ctx[14];
  	}

  	set setAnchorCorner(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAnchorMargin() {
  		return this.$$.ctx[15];
  	}

  	set setAnchorMargin(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setFixedPosition() {
  		return this.$$.ctx[16];
  	}

  	set setFixedPosition(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAbsolutePosition() {
  		return this.$$.ctx[17];
  	}

  	set setAbsolutePosition(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setMenuSurfaceAnchorElement() {
  		return this.$$.ctx[18];
  	}

  	set setMenuSurfaceAnchorElement(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get hoistMenuToBody() {
  		return this.$$.ctx[19];
  	}

  	set hoistMenuToBody(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setIsHoisted() {
  		return this.$$.ctx[20];
  	}

  	set setIsHoisted(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get getDefaultFoundation() {
  		return this.$$.ctx[21];
  	}

  	set getDefaultFoundation(value) {
  		throw new Error("<MenuSurface>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* node_modules/@smui/menu/Menu.svelte generated by Svelte v3.16.7 */

  // (1:0) <MenuSurface   bind:element   use={[forwardEvents, ...use]}   class="mdc-menu {className}"   on:MDCMenu:selected={updateOpen}   on:MDCMenuSurface:closed={updateOpen} on:MDCMenuSurface:opened={updateOpen}   {...exclude($$props, ['use', 'class', 'wrapFocus'])} >
  function create_default_slot$1(ctx) {
  	let current;
  	const default_slot_template = /*$$slots*/ ctx[34].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[36], null);

  	const block = {
  		c: function create() {
  			if (default_slot) default_slot.c();
  		},
  		m: function mount(target, anchor) {
  			if (default_slot) {
  				default_slot.m(target, anchor);
  			}

  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty[1] & /*$$scope*/ 32) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[36], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[36], dirty, null));
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (default_slot) default_slot.d(detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$1.name,
  		type: "slot",
  		source: "(1:0) <MenuSurface   bind:element   use={[forwardEvents, ...use]}   class=\\\"mdc-menu {className}\\\"   on:MDCMenu:selected={updateOpen}   on:MDCMenuSurface:closed={updateOpen} on:MDCMenuSurface:opened={updateOpen}   {...exclude($$props, ['use', 'class', 'wrapFocus'])} >",
  		ctx
  	});

  	return block;
  }

  function create_fragment$8(ctx) {
  	let updating_element;
  	let current;

  	const menusurface_spread_levels = [
  		{
  			use: [/*forwardEvents*/ ctx[3], .../*use*/ ctx[0]]
  		},
  		{
  			class: "mdc-menu " + /*className*/ ctx[1]
  		},
  		exclude(/*$$props*/ ctx[5], ["use", "class", "wrapFocus"])
  	];

  	function menusurface_element_binding(value) {
  		/*menusurface_element_binding*/ ctx[35].call(null, value);
  	}

  	let menusurface_props = {
  		$$slots: { default: [create_default_slot$1] },
  		$$scope: { ctx }
  	};

  	for (let i = 0; i < menusurface_spread_levels.length; i += 1) {
  		menusurface_props = assign(menusurface_props, menusurface_spread_levels[i]);
  	}

  	if (/*element*/ ctx[2] !== void 0) {
  		menusurface_props.element = /*element*/ ctx[2];
  	}

  	const menusurface = new MenuSurface({ props: menusurface_props, $$inline: true });
  	binding_callbacks.push(() => bind(menusurface, "element", menusurface_element_binding));
  	menusurface.$on("MDCMenu:selected", /*updateOpen*/ ctx[4]);
  	menusurface.$on("MDCMenuSurface:closed", /*updateOpen*/ ctx[4]);
  	menusurface.$on("MDCMenuSurface:opened", /*updateOpen*/ ctx[4]);

  	const block = {
  		c: function create() {
  			create_component(menusurface.$$.fragment);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			mount_component(menusurface, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const menusurface_changes = (dirty[0] & /*forwardEvents, use, className, $$props*/ 43)
  			? get_spread_update(menusurface_spread_levels, [
  					dirty[0] & /*forwardEvents, use*/ 9 && ({
  						use: [/*forwardEvents*/ ctx[3], .../*use*/ ctx[0]]
  					}),
  					dirty[0] & /*className*/ 2 && ({
  						class: "mdc-menu " + /*className*/ ctx[1]
  					}),
  					dirty[0] & /*$$props*/ 32 && get_spread_object(exclude(/*$$props*/ ctx[5], ["use", "class", "wrapFocus"]))
  				])
  			: {};

  			if (dirty[1] & /*$$scope*/ 32) {
  				menusurface_changes.$$scope = { dirty, ctx };
  			}

  			if (!updating_element && dirty[0] & /*element*/ 4) {
  				updating_element = true;
  				menusurface_changes.element = /*element*/ ctx[2];
  				add_flush_callback(() => updating_element = false);
  			}

  			menusurface.$set(menusurface_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(menusurface.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(menusurface.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(menusurface, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$8.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$8($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCMenu:selected", "MDCMenuSurface:closed", "MDCMenuSurface:opened"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { static: isStatic = false } = $$props;
  	let { open = isStatic } = $$props;
  	let { quickOpen = false } = $$props;
  	let { anchorCorner = null } = $$props;
  	let { wrapFocus = false } = $$props;
  	let element;
  	let menu;
  	let instantiate = getContext("SMUI:menu:instantiate");
  	let getInstance = getContext("SMUI:menu:getInstance");
  	let menuSurfacePromiseResolve;
  	let menuSurfacePromise = new Promise(resolve => menuSurfacePromiseResolve = resolve);
  	let listPromiseResolve;
  	let listPromise = new Promise(resolve => listPromiseResolve = resolve);
  	setContext("SMUI:menu-surface:instantiate", false);
  	setContext("SMUI:menu-surface:getInstance", getMenuSurfaceInstancePromise);
  	setContext("SMUI:list:instantiate", false);
  	setContext("SMUI:list:getInstance", getListInstancePromise);

  	onMount(async () => {
  		if (instantiate !== false) {
  			$$invalidate(25, menu = new MDCMenu(element));
  		} else {
  			$$invalidate(25, menu = await getInstance());
  		}

  		menuSurfacePromiseResolve(menu.menuSurface_);
  		listPromiseResolve(menu.list_);
  	});

  	onDestroy(() => {
  		if (instantiate !== false) {
  			menu && menu.destroy();
  		}
  	});

  	function getMenuSurfaceInstancePromise() {
  		return menuSurfacePromise;
  	}

  	function getListInstancePromise() {
  		return listPromise;
  	}

  	function updateOpen() {
  		$$invalidate(6, open = menu.open);
  	}

  	function setOpen(value) {
  		$$invalidate(6, open = value);
  	}

  	function getItems() {
  		return menu.items;
  	}

  	function setDefaultFocusState(...args) {
  		return menu.setDefaultFocusState(...args);
  	}

  	function setAnchorCorner(...args) {
  		return menu.setAnchorCorner(...args);
  	}

  	function setAnchorMargin(...args) {
  		return menu.setAnchorMargin(...args);
  	}

  	function setSelectedIndex(...args) {
  		return menu.setSelectedIndex(...args);
  	}

  	function setEnabled(...args) {
  		return menu.setEnabled(...args);
  	}

  	function getOptionByIndex(...args) {
  		return menu.getOptionByIndex(...args);
  	}

  	function setFixedPosition(...args) {
  		return menu.setFixedPosition(...args);
  	}

  	function hoistMenuToBody(...args) {
  		return menu.hoistMenuToBody(...args);
  	}

  	function setIsHoisted(...args) {
  		return menu.setIsHoisted(...args);
  	}

  	function setAbsolutePosition(...args) {
  		return menu.setAbsolutePosition(...args);
  	}

  	function setAnchorElement(...args) {
  		return menu.setAnchorElement(...args);
  	}

  	function getDefaultFoundation(...args) {
  		return menu.getDefaultFoundation(...args);
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function menusurface_element_binding(value) {
  		element = value;
  		$$invalidate(2, element);
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("static" in $$new_props) $$invalidate(7, isStatic = $$new_props.static);
  		if ("open" in $$new_props) $$invalidate(6, open = $$new_props.open);
  		if ("quickOpen" in $$new_props) $$invalidate(8, quickOpen = $$new_props.quickOpen);
  		if ("anchorCorner" in $$new_props) $$invalidate(9, anchorCorner = $$new_props.anchorCorner);
  		if ("wrapFocus" in $$new_props) $$invalidate(10, wrapFocus = $$new_props.wrapFocus);
  		if ("$$scope" in $$new_props) $$invalidate(36, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			isStatic,
  			open,
  			quickOpen,
  			anchorCorner,
  			wrapFocus,
  			element,
  			menu,
  			instantiate,
  			getInstance,
  			menuSurfacePromiseResolve,
  			menuSurfacePromise,
  			listPromiseResolve,
  			listPromise
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(5, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("isStatic" in $$props) $$invalidate(7, isStatic = $$new_props.isStatic);
  		if ("open" in $$props) $$invalidate(6, open = $$new_props.open);
  		if ("quickOpen" in $$props) $$invalidate(8, quickOpen = $$new_props.quickOpen);
  		if ("anchorCorner" in $$props) $$invalidate(9, anchorCorner = $$new_props.anchorCorner);
  		if ("wrapFocus" in $$props) $$invalidate(10, wrapFocus = $$new_props.wrapFocus);
  		if ("element" in $$props) $$invalidate(2, element = $$new_props.element);
  		if ("menu" in $$props) $$invalidate(25, menu = $$new_props.menu);
  		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
  		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
  		if ("menuSurfacePromiseResolve" in $$props) menuSurfacePromiseResolve = $$new_props.menuSurfacePromiseResolve;
  		if ("menuSurfacePromise" in $$props) menuSurfacePromise = $$new_props.menuSurfacePromise;
  		if ("listPromiseResolve" in $$props) listPromiseResolve = $$new_props.listPromiseResolve;
  		if ("listPromise" in $$props) listPromise = $$new_props.listPromise;
  	};

  	$$self.$$.update = () => {
  		if ($$self.$$.dirty[0] & /*menu, open, isStatic*/ 33554624) {
  			 if (menu && menu.open !== open) {
  				if (isStatic) {
  					$$invalidate(6, open = true);
  				}

  				$$invalidate(25, menu.open = open, menu);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*menu, wrapFocus*/ 33555456) {
  			 if (menu && menu.wrapFocus !== wrapFocus) {
  				$$invalidate(25, menu.wrapFocus = wrapFocus, menu);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*menu, quickOpen*/ 33554688) {
  			 if (menu) {
  				$$invalidate(25, menu.quickOpen = quickOpen, menu);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*menu, anchorCorner*/ 33554944) {
  			 if (menu && anchorCorner != null) {
  				if (Corner.hasOwnProperty(anchorCorner)) {
  					menu.setAnchorCorner(Corner[anchorCorner]);
  				} else if (CornerBit.hasOwnProperty(anchorCorner)) {
  					menu.setAnchorCorner(Corner[anchorCorner]);
  				} else {
  					menu.setAnchorCorner(anchorCorner);
  				}
  			}
  		}
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		element,
  		forwardEvents,
  		updateOpen,
  		$$props,
  		open,
  		isStatic,
  		quickOpen,
  		anchorCorner,
  		wrapFocus,
  		setOpen,
  		getItems,
  		setDefaultFocusState,
  		setAnchorCorner,
  		setAnchorMargin,
  		setSelectedIndex,
  		setEnabled,
  		getOptionByIndex,
  		setFixedPosition,
  		hoistMenuToBody,
  		setIsHoisted,
  		setAbsolutePosition,
  		setAnchorElement,
  		getDefaultFoundation,
  		menu,
  		menuSurfacePromiseResolve,
  		listPromiseResolve,
  		instantiate,
  		getInstance,
  		menuSurfacePromise,
  		listPromise,
  		getMenuSurfaceInstancePromise,
  		getListInstancePromise,
  		$$slots,
  		menusurface_element_binding,
  		$$scope
  	];
  }

  class Menu extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(
  			this,
  			options,
  			instance$8,
  			create_fragment$8,
  			safe_not_equal,
  			{
  				use: 0,
  				class: 1,
  				static: 7,
  				open: 6,
  				quickOpen: 8,
  				anchorCorner: 9,
  				wrapFocus: 10,
  				setOpen: 11,
  				getItems: 12,
  				setDefaultFocusState: 13,
  				setAnchorCorner: 14,
  				setAnchorMargin: 15,
  				setSelectedIndex: 16,
  				setEnabled: 17,
  				getOptionByIndex: 18,
  				setFixedPosition: 19,
  				hoistMenuToBody: 20,
  				setIsHoisted: 21,
  				setAbsolutePosition: 22,
  				setAnchorElement: 23,
  				getDefaultFoundation: 24
  			},
  			[-1, -1]
  		);

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Menu",
  			options,
  			id: create_fragment$8.name
  		});
  	}

  	get use() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get static() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set static(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get open() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set open(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get quickOpen() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set quickOpen(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get anchorCorner() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set anchorCorner(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get wrapFocus() {
  		throw new Error("<Menu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set wrapFocus(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setOpen() {
  		return this.$$.ctx[11];
  	}

  	set setOpen(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get getItems() {
  		return this.$$.ctx[12];
  	}

  	set getItems(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setDefaultFocusState() {
  		return this.$$.ctx[13];
  	}

  	set setDefaultFocusState(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAnchorCorner() {
  		return this.$$.ctx[14];
  	}

  	set setAnchorCorner(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAnchorMargin() {
  		return this.$$.ctx[15];
  	}

  	set setAnchorMargin(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setSelectedIndex() {
  		return this.$$.ctx[16];
  	}

  	set setSelectedIndex(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setEnabled() {
  		return this.$$.ctx[17];
  	}

  	set setEnabled(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get getOptionByIndex() {
  		return this.$$.ctx[18];
  	}

  	set getOptionByIndex(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setFixedPosition() {
  		return this.$$.ctx[19];
  	}

  	set setFixedPosition(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get hoistMenuToBody() {
  		return this.$$.ctx[20];
  	}

  	set hoistMenuToBody(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setIsHoisted() {
  		return this.$$.ctx[21];
  	}

  	set setIsHoisted(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAbsolutePosition() {
  		return this.$$.ctx[22];
  	}

  	set setAbsolutePosition(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setAnchorElement() {
  		return this.$$.ctx[23];
  	}

  	set setAnchorElement(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get getDefaultFoundation() {
  		return this.$$.ctx[24];
  	}

  	set getDefaultFoundation(value) {
  		throw new Error("<Menu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var Graphic = classAdderBuilder({
    class: 'mdc-list-item__graphic',
    component: Span,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-menu__selection-group-icon',
    component: Graphic,
    contexts: {}
  });

  /* node_modules/@smui/list/List.svelte generated by Svelte v3.16.7 */
  const file$7 = "node_modules/@smui/list/List.svelte";

  // (18:0) {:else}
  function create_else_block$1(ctx) {
  	let ul;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[29].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

  	let ul_levels = [
  		{
  			class: "\n      mdc-list\n      " + /*className*/ ctx[1] + "\n      " + (/*nonInteractive*/ ctx[2]
  			? "mdc-list--non-interactive"
  			: "") + "\n      " + (/*dense*/ ctx[3] ? "mdc-list--dense" : "") + "\n      " + (/*avatarList*/ ctx[4] ? "mdc-list--avatar-list" : "") + "\n      " + (/*twoLine*/ ctx[5] ? "mdc-list--two-line" : "") + "\n      " + (/*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]
  			? "smui-list--three-line"
  			: "") + "\n    "
  		},
  		{ role: /*role*/ ctx[8] },
  		/*props*/ ctx[9]
  	];

  	let ul_data = {};

  	for (let i = 0; i < ul_levels.length; i += 1) {
  		ul_data = assign(ul_data, ul_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			ul = element("ul");
  			if (default_slot) default_slot.c();
  			set_attributes(ul, ul_data);
  			add_location(ul, file$7, 18, 2, 478);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, ul, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, ul)),
  				listen_dev(ul, "MDCList:action", /*handleAction*/ ctx[12], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, ul, anchor);

  			if (default_slot) {
  				default_slot.m(ul, null);
  			}

  			/*ul_binding*/ ctx[31](ul);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty[0] & /*$$scope*/ 268435456) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[28], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[28], dirty, null));
  			}

  			set_attributes(ul, get_spread_update(ul_levels, [
  				dirty[0] & /*className, nonInteractive, dense, avatarList, twoLine, threeLine*/ 126 && ({
  					class: "\n      mdc-list\n      " + /*className*/ ctx[1] + "\n      " + (/*nonInteractive*/ ctx[2]
  					? "mdc-list--non-interactive"
  					: "") + "\n      " + (/*dense*/ ctx[3] ? "mdc-list--dense" : "") + "\n      " + (/*avatarList*/ ctx[4] ? "mdc-list--avatar-list" : "") + "\n      " + (/*twoLine*/ ctx[5] ? "mdc-list--two-line" : "") + "\n      " + (/*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]
  					? "smui-list--three-line"
  					: "") + "\n    "
  				}),
  				dirty[0] & /*role*/ 256 && ({ role: /*role*/ ctx[8] }),
  				dirty[0] & /*props*/ 512 && /*props*/ ctx[9]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(ul);
  			if (default_slot) default_slot.d(detaching);
  			/*ul_binding*/ ctx[31](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$1.name,
  		type: "else",
  		source: "(18:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (1:0) {#if nav}
  function create_if_block$1(ctx) {
  	let nav_1;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[29].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

  	let nav_1_levels = [
  		{
  			class: "\n      mdc-list\n      " + /*className*/ ctx[1] + "\n      " + (/*nonInteractive*/ ctx[2]
  			? "mdc-list--non-interactive"
  			: "") + "\n      " + (/*dense*/ ctx[3] ? "mdc-list--dense" : "") + "\n      " + (/*avatarList*/ ctx[4] ? "mdc-list--avatar-list" : "") + "\n      " + (/*twoLine*/ ctx[5] ? "mdc-list--two-line" : "") + "\n      " + (/*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]
  			? "smui-list--three-line"
  			: "") + "\n    "
  		},
  		/*props*/ ctx[9]
  	];

  	let nav_1_data = {};

  	for (let i = 0; i < nav_1_levels.length; i += 1) {
  		nav_1_data = assign(nav_1_data, nav_1_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			nav_1 = element("nav");
  			if (default_slot) default_slot.c();
  			set_attributes(nav_1, nav_1_data);
  			add_location(nav_1, file$7, 1, 2, 12);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, nav_1, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, nav_1)),
  				listen_dev(nav_1, "MDCList:action", /*handleAction*/ ctx[12], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, nav_1, anchor);

  			if (default_slot) {
  				default_slot.m(nav_1, null);
  			}

  			/*nav_1_binding*/ ctx[30](nav_1);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty[0] & /*$$scope*/ 268435456) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[28], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[28], dirty, null));
  			}

  			set_attributes(nav_1, get_spread_update(nav_1_levels, [
  				dirty[0] & /*className, nonInteractive, dense, avatarList, twoLine, threeLine*/ 126 && ({
  					class: "\n      mdc-list\n      " + /*className*/ ctx[1] + "\n      " + (/*nonInteractive*/ ctx[2]
  					? "mdc-list--non-interactive"
  					: "") + "\n      " + (/*dense*/ ctx[3] ? "mdc-list--dense" : "") + "\n      " + (/*avatarList*/ ctx[4] ? "mdc-list--avatar-list" : "") + "\n      " + (/*twoLine*/ ctx[5] ? "mdc-list--two-line" : "") + "\n      " + (/*threeLine*/ ctx[6] && !/*twoLine*/ ctx[5]
  					? "smui-list--three-line"
  					: "") + "\n    "
  				}),
  				dirty[0] & /*props*/ 512 && /*props*/ ctx[9]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(nav_1);
  			if (default_slot) default_slot.d(detaching);
  			/*nav_1_binding*/ ctx[30](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$1.name,
  		type: "if",
  		source: "(1:0) {#if nav}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$9(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$1, create_else_block$1];
  	const if_blocks = [];

  	function select_block_type(ctx, dirty) {
  		if (/*nav*/ ctx[11]) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if_block.p(ctx, dirty);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$9.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$9($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCList:action"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { nonInteractive = false } = $$props;
  	let { dense = false } = $$props;
  	let { avatarList = false } = $$props;
  	let { twoLine = false } = $$props;
  	let { threeLine = false } = $$props;
  	let { vertical = true } = $$props;
  	let { wrapFocus = false } = $$props;
  	let { singleSelection = false } = $$props;
  	let { selectedIndex = null } = $$props;
  	let { radiolist = false } = $$props;
  	let { checklist = false } = $$props;
  	let element;
  	let list;
  	let role = getContext("SMUI:list:role");
  	let nav = getContext("SMUI:list:nav");
  	let instantiate = getContext("SMUI:list:instantiate");
  	let getInstance = getContext("SMUI:list:getInstance");
  	let addLayoutListener = getContext("SMUI:addLayoutListener");
  	let removeLayoutListener;
  	setContext("SMUI:list:nonInteractive", nonInteractive);

  	if (!role) {
  		if (singleSelection) {
  			role = "listbox";
  			setContext("SMUI:list:item:role", "option");
  		} else if (radiolist) {
  			role = "radiogroup";
  			setContext("SMUI:list:item:role", "radio");
  		} else if (checklist) {
  			role = "group";
  			setContext("SMUI:list:item:role", "checkbox");
  		} else {
  			role = "list";
  			setContext("SMUI:list:item:role", undefined);
  		}
  	}

  	if (addLayoutListener) {
  		removeLayoutListener = addLayoutListener(layout);
  	}

  	onMount(async () => {
  		if (instantiate !== false) {
  			$$invalidate(22, list = new MDCList(element));
  		} else {
  			$$invalidate(22, list = await getInstance());
  		}

  		if (singleSelection) {
  			list.initializeListType();
  			$$invalidate(13, selectedIndex = list.selectedIndex);
  		}
  	});

  	onDestroy(() => {
  		if (instantiate !== false) {
  			list && list.destroy();
  		}

  		if (removeLayoutListener) {
  			removeLayoutListener();
  		}
  	});

  	function handleAction(e) {
  		if (list && list.listElements[e.detail.index].classList.contains("mdc-list-item--disabled")) {
  			e.preventDefault();
  			$$invalidate(22, list.selectedIndex = selectedIndex, list);
  		} else if (list && list.selectedIndex === e.detail.index) {
  			$$invalidate(13, selectedIndex = e.detail.index);
  		}
  	}

  	function layout(...args) {
  		return list.layout(...args);
  	}

  	function setEnabled(...args) {
  		return list.setEnabled(...args);
  	}

  	function getDefaultFoundation(...args) {
  		return list.getDefaultFoundation(...args);
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function nav_1_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(7, element = $$value);
  		});
  	}

  	function ul_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(7, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(27, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("nonInteractive" in $$new_props) $$invalidate(2, nonInteractive = $$new_props.nonInteractive);
  		if ("dense" in $$new_props) $$invalidate(3, dense = $$new_props.dense);
  		if ("avatarList" in $$new_props) $$invalidate(4, avatarList = $$new_props.avatarList);
  		if ("twoLine" in $$new_props) $$invalidate(5, twoLine = $$new_props.twoLine);
  		if ("threeLine" in $$new_props) $$invalidate(6, threeLine = $$new_props.threeLine);
  		if ("vertical" in $$new_props) $$invalidate(14, vertical = $$new_props.vertical);
  		if ("wrapFocus" in $$new_props) $$invalidate(15, wrapFocus = $$new_props.wrapFocus);
  		if ("singleSelection" in $$new_props) $$invalidate(16, singleSelection = $$new_props.singleSelection);
  		if ("selectedIndex" in $$new_props) $$invalidate(13, selectedIndex = $$new_props.selectedIndex);
  		if ("radiolist" in $$new_props) $$invalidate(17, radiolist = $$new_props.radiolist);
  		if ("checklist" in $$new_props) $$invalidate(18, checklist = $$new_props.checklist);
  		if ("$$scope" in $$new_props) $$invalidate(28, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			nonInteractive,
  			dense,
  			avatarList,
  			twoLine,
  			threeLine,
  			vertical,
  			wrapFocus,
  			singleSelection,
  			selectedIndex,
  			radiolist,
  			checklist,
  			element,
  			list,
  			role,
  			nav,
  			instantiate,
  			getInstance,
  			addLayoutListener,
  			removeLayoutListener,
  			props
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(27, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("nonInteractive" in $$props) $$invalidate(2, nonInteractive = $$new_props.nonInteractive);
  		if ("dense" in $$props) $$invalidate(3, dense = $$new_props.dense);
  		if ("avatarList" in $$props) $$invalidate(4, avatarList = $$new_props.avatarList);
  		if ("twoLine" in $$props) $$invalidate(5, twoLine = $$new_props.twoLine);
  		if ("threeLine" in $$props) $$invalidate(6, threeLine = $$new_props.threeLine);
  		if ("vertical" in $$props) $$invalidate(14, vertical = $$new_props.vertical);
  		if ("wrapFocus" in $$props) $$invalidate(15, wrapFocus = $$new_props.wrapFocus);
  		if ("singleSelection" in $$props) $$invalidate(16, singleSelection = $$new_props.singleSelection);
  		if ("selectedIndex" in $$props) $$invalidate(13, selectedIndex = $$new_props.selectedIndex);
  		if ("radiolist" in $$props) $$invalidate(17, radiolist = $$new_props.radiolist);
  		if ("checklist" in $$props) $$invalidate(18, checklist = $$new_props.checklist);
  		if ("element" in $$props) $$invalidate(7, element = $$new_props.element);
  		if ("list" in $$props) $$invalidate(22, list = $$new_props.list);
  		if ("role" in $$props) $$invalidate(8, role = $$new_props.role);
  		if ("nav" in $$props) $$invalidate(11, nav = $$new_props.nav);
  		if ("instantiate" in $$props) instantiate = $$new_props.instantiate;
  		if ("getInstance" in $$props) getInstance = $$new_props.getInstance;
  		if ("addLayoutListener" in $$props) addLayoutListener = $$new_props.addLayoutListener;
  		if ("removeLayoutListener" in $$props) removeLayoutListener = $$new_props.removeLayoutListener;
  		if ("props" in $$props) $$invalidate(9, props = $$new_props.props);
  	};

  	let props;

  	$$self.$$.update = () => {
  		 $$invalidate(9, props = exclude($$props, [
  			"use",
  			"class",
  			"nonInteractive",
  			"dense",
  			"avatarList",
  			"twoLine",
  			"threeLine",
  			"vertical",
  			"wrapFocus",
  			"singleSelection",
  			"selectedIndex",
  			"radiolist",
  			"checklist"
  		]));

  		if ($$self.$$.dirty[0] & /*list, vertical*/ 4210688) {
  			 if (list && list.vertical !== vertical) {
  				$$invalidate(22, list.vertical = vertical, list);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*list, wrapFocus*/ 4227072) {
  			 if (list && list.wrapFocus !== wrapFocus) {
  				$$invalidate(22, list.wrapFocus = wrapFocus, list);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*list, singleSelection*/ 4259840) {
  			 if (list && list.singleSelection !== singleSelection) {
  				$$invalidate(22, list.singleSelection = singleSelection, list);
  			}
  		}

  		if ($$self.$$.dirty[0] & /*list, singleSelection, selectedIndex*/ 4268032) {
  			 if (list && singleSelection && list.selectedIndex !== selectedIndex) {
  				$$invalidate(22, list.selectedIndex = selectedIndex, list);
  			}
  		}
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		nonInteractive,
  		dense,
  		avatarList,
  		twoLine,
  		threeLine,
  		element,
  		role,
  		props,
  		forwardEvents,
  		nav,
  		handleAction,
  		selectedIndex,
  		vertical,
  		wrapFocus,
  		singleSelection,
  		radiolist,
  		checklist,
  		layout,
  		setEnabled,
  		getDefaultFoundation,
  		list,
  		removeLayoutListener,
  		instantiate,
  		getInstance,
  		addLayoutListener,
  		$$props,
  		$$scope,
  		$$slots,
  		nav_1_binding,
  		ul_binding
  	];
  }

  class List extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(
  			this,
  			options,
  			instance$9,
  			create_fragment$9,
  			safe_not_equal,
  			{
  				use: 0,
  				class: 1,
  				nonInteractive: 2,
  				dense: 3,
  				avatarList: 4,
  				twoLine: 5,
  				threeLine: 6,
  				vertical: 14,
  				wrapFocus: 15,
  				singleSelection: 16,
  				selectedIndex: 13,
  				radiolist: 17,
  				checklist: 18,
  				layout: 19,
  				setEnabled: 20,
  				getDefaultFoundation: 21
  			},
  			[-1, -1]
  		);

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "List",
  			options,
  			id: create_fragment$9.name
  		});
  	}

  	get use() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get nonInteractive() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set nonInteractive(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get dense() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set dense(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get avatarList() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set avatarList(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get twoLine() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set twoLine(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get threeLine() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set threeLine(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get vertical() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set vertical(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get wrapFocus() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set wrapFocus(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get singleSelection() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set singleSelection(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get selectedIndex() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set selectedIndex(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get radiolist() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set radiolist(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get checklist() {
  		throw new Error("<List>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set checklist(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get layout() {
  		return this.$$.ctx[19];
  	}

  	set layout(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setEnabled() {
  		return this.$$.ctx[20];
  	}

  	set setEnabled(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get getDefaultFoundation() {
  		return this.$$.ctx[21];
  	}

  	set getDefaultFoundation(value) {
  		throw new Error("<List>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* node_modules/@smui/list/Item.svelte generated by Svelte v3.16.7 */
  const file$8 = "node_modules/@smui/list/Item.svelte";

  // (40:0) {:else}
  function create_else_block$2(ctx) {
  	let li;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[25].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

  	let li_levels = [
  		/*role*/ ctx[6] === "option"
  		? {
  				"aria-selected": /*selected*/ ctx[7] ? "true" : "false"
  			}
  		: {},
  		/*props*/ ctx[12],
  		{
  			class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n      " + (/*role*/ ctx[6] === "menuitem" && /*selected*/ ctx[7]
  			? "mdc-menu-item--selected"
  			: "") + "\n    "
  		},
  		{ role: /*role*/ ctx[6] },
  		/*role*/ ctx[6] === "radio" || /*role*/ ctx[6] === "checkbox"
  		? {
  				"aria-checked": /*checked*/ ctx[10] ? "true" : "false"
  			}
  		: {},
  		{ tabindex: /*tabindex*/ ctx[0] }
  	];

  	let li_data = {};

  	for (let i = 0; i < li_levels.length; i += 1) {
  		li_data = assign(li_data, li_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			li = element("li");
  			if (default_slot) default_slot.c();
  			set_attributes(li, li_data);
  			add_location(li, file$8, 40, 2, 1057);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, li, /*use*/ ctx[1])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, li)),
  				action_destroyer(Ripple_action = Ripple.call(null, li, [
  					/*ripple*/ ctx[3],
  					{
  						unbounded: false,
  						color: /*color*/ ctx[4]
  					}
  				])),
  				listen_dev(li, "click", /*action*/ ctx[15], false, false, false),
  				listen_dev(li, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, li, anchor);

  			if (default_slot) {
  				default_slot.m(li, null);
  			}

  			/*li_binding*/ ctx[28](li);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
  			}

  			set_attributes(li, get_spread_update(li_levels, [
  				dirty & /*role, selected*/ 192 && (/*role*/ ctx[6] === "option"
  				? {
  						"aria-selected": /*selected*/ ctx[7] ? "true" : "false"
  					}
  				: {}),
  				dirty & /*props*/ 4096 && /*props*/ ctx[12],
  				dirty & /*className, activated, selected, disabled, role*/ 484 && ({
  					class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n      " + (/*role*/ ctx[6] === "menuitem" && /*selected*/ ctx[7]
  					? "mdc-menu-item--selected"
  					: "") + "\n    "
  				}),
  				dirty & /*role*/ 64 && ({ role: /*role*/ ctx[6] }),
  				dirty & /*role, checked*/ 1088 && (/*role*/ ctx[6] === "radio" || /*role*/ ctx[6] === "checkbox"
  				? {
  						"aria-checked": /*checked*/ ctx[10] ? "true" : "false"
  					}
  				: {}),
  				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] })
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
  				/*ripple*/ ctx[3],
  				{
  					unbounded: false,
  					color: /*color*/ ctx[4]
  				}
  			]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(li);
  			if (default_slot) default_slot.d(detaching);
  			/*li_binding*/ ctx[28](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$2.name,
  		type: "else",
  		source: "(40:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (21:23) 
  function create_if_block_1(ctx) {
  	let span;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[25].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

  	let span_levels = [
  		{
  			class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n    "
  		},
  		/*activated*/ ctx[5] ? { "aria-current": "page" } : {},
  		{ tabindex: /*tabindex*/ ctx[0] },
  		/*props*/ ctx[12]
  	];

  	let span_data = {};

  	for (let i = 0; i < span_levels.length; i += 1) {
  		span_data = assign(span_data, span_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			span = element("span");
  			if (default_slot) default_slot.c();
  			set_attributes(span, span_data);
  			add_location(span, file$8, 21, 2, 549);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, span, /*use*/ ctx[1])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, span)),
  				action_destroyer(Ripple_action = Ripple.call(null, span, [
  					/*ripple*/ ctx[3],
  					{
  						unbounded: false,
  						color: /*color*/ ctx[4]
  					}
  				])),
  				listen_dev(span, "click", /*action*/ ctx[15], false, false, false),
  				listen_dev(span, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, span, anchor);

  			if (default_slot) {
  				default_slot.m(span, null);
  			}

  			/*span_binding*/ ctx[27](span);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
  			}

  			set_attributes(span, get_spread_update(span_levels, [
  				dirty & /*className, activated, selected, disabled*/ 420 && ({
  					class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n    "
  				}),
  				dirty & /*activated*/ 32 && (/*activated*/ ctx[5] ? { "aria-current": "page" } : {}),
  				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] }),
  				dirty & /*props*/ 4096 && /*props*/ ctx[12]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
  				/*ripple*/ ctx[3],
  				{
  					unbounded: false,
  					color: /*color*/ ctx[4]
  				}
  			]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(span);
  			if (default_slot) default_slot.d(detaching);
  			/*span_binding*/ ctx[27](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block_1.name,
  		type: "if",
  		source: "(21:23) ",
  		ctx
  	});

  	return block;
  }

  // (1:0) {#if nav && href}
  function create_if_block$2(ctx) {
  	let a;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[25].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], null);

  	let a_levels = [
  		{ href: /*href*/ ctx[9] },
  		/*props*/ ctx[12],
  		{
  			class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n    "
  		},
  		/*activated*/ ctx[5] ? { "aria-current": "page" } : {},
  		{ tabindex: /*tabindex*/ ctx[0] }
  	];

  	let a_data = {};

  	for (let i = 0; i < a_levels.length; i += 1) {
  		a_data = assign(a_data, a_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			a = element("a");
  			if (default_slot) default_slot.c();
  			set_attributes(a, a_data);
  			add_location(a, file$8, 1, 2, 20);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, a, /*use*/ ctx[1])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[13].call(null, a)),
  				action_destroyer(Ripple_action = Ripple.call(null, a, [
  					/*ripple*/ ctx[3],
  					{
  						unbounded: false,
  						color: /*color*/ ctx[4]
  					}
  				])),
  				listen_dev(a, "click", /*action*/ ctx[15], false, false, false),
  				listen_dev(a, "keydown", /*handleKeydown*/ ctx[16], false, false, false)
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, a, anchor);

  			if (default_slot) {
  				default_slot.m(a, null);
  			}

  			/*a_binding*/ ctx[26](a);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 16777216) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[24], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, null));
  			}

  			set_attributes(a, get_spread_update(a_levels, [
  				dirty & /*href*/ 512 && ({ href: /*href*/ ctx[9] }),
  				dirty & /*props*/ 4096 && /*props*/ ctx[12],
  				dirty & /*className, activated, selected, disabled*/ 420 && ({
  					class: "\n      mdc-list-item\n      " + /*className*/ ctx[2] + "\n      " + (/*activated*/ ctx[5] ? "mdc-list-item--activated" : "") + "\n      " + (/*selected*/ ctx[7] ? "mdc-list-item--selected" : "") + "\n      " + (/*disabled*/ ctx[8] ? "mdc-list-item--disabled" : "") + "\n    "
  				}),
  				dirty & /*activated*/ 32 && (/*activated*/ ctx[5] ? { "aria-current": "page" } : {}),
  				dirty & /*tabindex*/ 1 && ({ tabindex: /*tabindex*/ ctx[0] })
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);

  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple, color*/ 24) Ripple_action.update.call(null, [
  				/*ripple*/ ctx[3],
  				{
  					unbounded: false,
  					color: /*color*/ ctx[4]
  				}
  			]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(a);
  			if (default_slot) default_slot.d(detaching);
  			/*a_binding*/ ctx[26](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$2.name,
  		type: "if",
  		source: "(1:0) {#if nav && href}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$a(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$2, create_if_block_1, create_else_block$2];
  	const if_blocks = [];

  	function select_block_type(ctx, dirty) {
  		if (/*nav*/ ctx[14] && /*href*/ ctx[9]) return 0;
  		if (/*nav*/ ctx[14] && !/*href*/ ctx[9]) return 1;
  		return 2;
  	}

  	current_block_type_index = select_block_type(ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(ctx, dirty);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$a.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  let counter = 0;

  function instance$a($$self, $$props, $$invalidate) {
  	const dispatch = createEventDispatcher();
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let checked = false;
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { ripple = true } = $$props;
  	let { color = null } = $$props;
  	let { nonInteractive = getContext("SMUI:list:nonInteractive") } = $$props;
  	let { activated = false } = $$props;
  	let { role = getContext("SMUI:list:item:role") } = $$props;
  	let { selected = false } = $$props;
  	let { disabled = false } = $$props;
  	let { tabindex = !nonInteractive && !disabled && (selected || checked) && "0" || "-1" } = $$props;
  	let { href = false } = $$props;
  	let { inputId = "SMUI-form-field-list-" + counter++ } = $$props;
  	let element;
  	let addTabindexIfNoItemsSelectedRaf;
  	let nav = getContext("SMUI:list:item:nav");
  	setContext("SMUI:generic:input:props", { id: inputId });
  	setContext("SMUI:generic:input:setChecked", setChecked);

  	onMount(() => {
  		if (!selected && !nonInteractive) {
  			let first = true;
  			let el = element;

  			while (el.previousSibling) {
  				el = el.previousSibling;

  				if (el.nodeType === 1 && el.classList.contains("mdc-list-item") && !el.classList.contains("mdc-list-item--disabled")) {
  					first = false;
  					break;
  				}
  			}

  			if (first) {
  				addTabindexIfNoItemsSelectedRaf = window.requestAnimationFrame(addTabindexIfNoItemsSelected);
  			}
  		}
  	});

  	onDestroy(() => {
  		if (addTabindexIfNoItemsSelectedRaf) {
  			window.cancelAnimationFrame(addTabindexIfNoItemsSelectedRaf);
  		}
  	});

  	function addTabindexIfNoItemsSelected() {
  		let noneSelected = true;
  		let el = element;

  		while (el.nextSibling) {
  			el = el.nextSibling;

  			if (el.nodeType === 1 && el.classList.contains("mdc-list-item") && el.attributes["tabindex"] && el.attributes["tabindex"].value === "0") {
  				noneSelected = false;
  				break;
  			}
  		}

  		if (noneSelected) {
  			$$invalidate(0, tabindex = "0");
  		}
  	}

  	function action(e) {
  		if (disabled) {
  			e.preventDefault();
  		} else {
  			dispatch("SMUI:action", e);
  		}
  	}

  	function handleKeydown(e) {
  		const isEnter = e.key === "Enter" || e.keyCode === 13;
  		const isSpace = e.key === "Space" || e.keyCode === 32;

  		if (isEnter || isSpace) {
  			action(e);
  		}
  	}

  	function setChecked(isChecked) {
  		$$invalidate(10, checked = isChecked);
  		$$invalidate(0, tabindex = !nonInteractive && !disabled && (selected || checked) && "0" || "-1");
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function a_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(11, element = $$value);
  		});
  	}

  	function span_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(11, element = $$value);
  		});
  	}

  	function li_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(11, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(23, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(1, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(2, className = $$new_props.class);
  		if ("ripple" in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
  		if ("color" in $$new_props) $$invalidate(4, color = $$new_props.color);
  		if ("nonInteractive" in $$new_props) $$invalidate(17, nonInteractive = $$new_props.nonInteractive);
  		if ("activated" in $$new_props) $$invalidate(5, activated = $$new_props.activated);
  		if ("role" in $$new_props) $$invalidate(6, role = $$new_props.role);
  		if ("selected" in $$new_props) $$invalidate(7, selected = $$new_props.selected);
  		if ("disabled" in $$new_props) $$invalidate(8, disabled = $$new_props.disabled);
  		if ("tabindex" in $$new_props) $$invalidate(0, tabindex = $$new_props.tabindex);
  		if ("href" in $$new_props) $$invalidate(9, href = $$new_props.href);
  		if ("inputId" in $$new_props) $$invalidate(18, inputId = $$new_props.inputId);
  		if ("$$scope" in $$new_props) $$invalidate(24, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			counter,
  			checked,
  			use,
  			className,
  			ripple,
  			color,
  			nonInteractive,
  			activated,
  			role,
  			selected,
  			disabled,
  			tabindex,
  			href,
  			inputId,
  			element,
  			addTabindexIfNoItemsSelectedRaf,
  			nav,
  			props
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(23, $$props = assign(assign({}, $$props), $$new_props));
  		if ("checked" in $$props) $$invalidate(10, checked = $$new_props.checked);
  		if ("use" in $$props) $$invalidate(1, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(2, className = $$new_props.className);
  		if ("ripple" in $$props) $$invalidate(3, ripple = $$new_props.ripple);
  		if ("color" in $$props) $$invalidate(4, color = $$new_props.color);
  		if ("nonInteractive" in $$props) $$invalidate(17, nonInteractive = $$new_props.nonInteractive);
  		if ("activated" in $$props) $$invalidate(5, activated = $$new_props.activated);
  		if ("role" in $$props) $$invalidate(6, role = $$new_props.role);
  		if ("selected" in $$props) $$invalidate(7, selected = $$new_props.selected);
  		if ("disabled" in $$props) $$invalidate(8, disabled = $$new_props.disabled);
  		if ("tabindex" in $$props) $$invalidate(0, tabindex = $$new_props.tabindex);
  		if ("href" in $$props) $$invalidate(9, href = $$new_props.href);
  		if ("inputId" in $$props) $$invalidate(18, inputId = $$new_props.inputId);
  		if ("element" in $$props) $$invalidate(11, element = $$new_props.element);
  		if ("addTabindexIfNoItemsSelectedRaf" in $$props) addTabindexIfNoItemsSelectedRaf = $$new_props.addTabindexIfNoItemsSelectedRaf;
  		if ("nav" in $$props) $$invalidate(14, nav = $$new_props.nav);
  		if ("props" in $$props) $$invalidate(12, props = $$new_props.props);
  	};

  	let props;

  	$$self.$$.update = () => {
  		 $$invalidate(12, props = exclude($$props, [
  			"use",
  			"class",
  			"ripple",
  			"color",
  			"nonInteractive",
  			"activated",
  			"selected",
  			"disabled",
  			"tabindex",
  			"href",
  			"inputId"
  		]));
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		tabindex,
  		use,
  		className,
  		ripple,
  		color,
  		activated,
  		role,
  		selected,
  		disabled,
  		href,
  		checked,
  		element,
  		props,
  		forwardEvents,
  		nav,
  		action,
  		handleKeydown,
  		nonInteractive,
  		inputId,
  		addTabindexIfNoItemsSelectedRaf,
  		dispatch,
  		addTabindexIfNoItemsSelected,
  		setChecked,
  		$$props,
  		$$scope,
  		$$slots,
  		a_binding,
  		span_binding,
  		li_binding
  	];
  }

  class Item extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
  			use: 1,
  			class: 2,
  			ripple: 3,
  			color: 4,
  			nonInteractive: 17,
  			activated: 5,
  			role: 6,
  			selected: 7,
  			disabled: 8,
  			tabindex: 0,
  			href: 9,
  			inputId: 18
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Item",
  			options,
  			id: create_fragment$a.name
  		});
  	}

  	get use() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get ripple() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set ripple(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get color() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set color(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get nonInteractive() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set nonInteractive(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get activated() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set activated(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get role() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set role(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get selected() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set selected(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get disabled() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set disabled(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get tabindex() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set tabindex(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get href() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set href(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get inputId() {
  		throw new Error("<Item>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set inputId(value) {
  		throw new Error("<Item>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var Text = classAdderBuilder({
    class: 'mdc-list-item__text',
    component: Span,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-list-item__primary-text',
    component: Span,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-list-item__secondary-text',
    component: Span,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-list-item__meta',
    component: Span,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-list-group',
    component: Div,
    contexts: {}
  });

  /* node_modules/@smui/common/H3.svelte generated by Svelte v3.16.7 */
  const file$9 = "node_modules/@smui/common/H3.svelte";

  function create_fragment$b(ctx) {
  	let h3;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[4].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
  	let h3_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
  	let h3_data = {};

  	for (let i = 0; i < h3_levels.length; i += 1) {
  		h3_data = assign(h3_data, h3_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			h3 = element("h3");
  			if (default_slot) default_slot.c();
  			set_attributes(h3, h3_data);
  			add_location(h3, file$9, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, h3, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, h3))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h3, anchor);

  			if (default_slot) {
  				default_slot.m(h3, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
  			}

  			set_attributes(h3, get_spread_update(h3_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h3);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$b.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$b($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, forwardEvents, $$props, $$scope, $$slots];
  }

  class H3 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$b, create_fragment$b, safe_not_equal, { use: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "H3",
  			options,
  			id: create_fragment$b.name
  		});
  	}

  	get use() {
  		throw new Error("<H3>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<H3>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  classAdderBuilder({
    class: 'mdc-list-group__subheader',
    component: H3,
    contexts: {}
  });

  var candidateSelectors = [
    'input',
    'select',
    'textarea',
    'a[href]',
    'button',
    '[tabindex]',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
  ];
  var candidateSelector = candidateSelectors.join(',');

  var matches$1 = typeof Element === 'undefined'
    ? function () {}
    : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;

  function tabbable(el, options) {
    options = options || {};

    var regularTabbables = [];
    var orderedTabbables = [];

    var candidates = el.querySelectorAll(candidateSelector);

    if (options.includeContainer) {
      if (matches$1.call(el, candidateSelector)) {
        candidates = Array.prototype.slice.apply(candidates);
        candidates.unshift(el);
      }
    }

    var i, candidate, candidateTabindex;
    for (i = 0; i < candidates.length; i++) {
      candidate = candidates[i];

      if (!isNodeMatchingSelectorTabbable(candidate)) continue;

      candidateTabindex = getTabindex(candidate);
      if (candidateTabindex === 0) {
        regularTabbables.push(candidate);
      } else {
        orderedTabbables.push({
          documentOrder: i,
          tabIndex: candidateTabindex,
          node: candidate,
        });
      }
    }

    var tabbableNodes = orderedTabbables
      .sort(sortOrderedTabbables)
      .map(function(a) { return a.node })
      .concat(regularTabbables);

    return tabbableNodes;
  }

  tabbable.isTabbable = isTabbable;
  tabbable.isFocusable = isFocusable;

  function isNodeMatchingSelectorTabbable(node) {
    if (
      !isNodeMatchingSelectorFocusable(node)
      || isNonTabbableRadio(node)
      || getTabindex(node) < 0
    ) {
      return false;
    }
    return true;
  }

  function isTabbable(node) {
    if (!node) throw new Error('No node provided');
    if (matches$1.call(node, candidateSelector) === false) return false;
    return isNodeMatchingSelectorTabbable(node);
  }

  function isNodeMatchingSelectorFocusable(node) {
    if (
      node.disabled
      || isHiddenInput(node)
      || isHidden(node)
    ) {
      return false;
    }
    return true;
  }

  var focusableCandidateSelector = candidateSelectors.concat('iframe').join(',');
  function isFocusable(node) {
    if (!node) throw new Error('No node provided');
    if (matches$1.call(node, focusableCandidateSelector) === false) return false;
    return isNodeMatchingSelectorFocusable(node);
  }

  function getTabindex(node) {
    var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);
    if (!isNaN(tabindexAttr)) return tabindexAttr;
    // Browsers do not return `tabIndex` correctly for contentEditable nodes;
    // so if they don't have a tabindex attribute specifically set, assume it's 0.
    if (isContentEditable(node)) return 0;
    return node.tabIndex;
  }

  function sortOrderedTabbables(a, b) {
    return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
  }

  function isContentEditable(node) {
    return node.contentEditable === 'true';
  }

  function isInput(node) {
    return node.tagName === 'INPUT';
  }

  function isHiddenInput(node) {
    return isInput(node) && node.type === 'hidden';
  }

  function isRadio(node) {
    return isInput(node) && node.type === 'radio';
  }

  function isNonTabbableRadio(node) {
    return isRadio(node) && !isTabbableRadio(node);
  }

  function getCheckedRadio(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].checked) {
        return nodes[i];
      }
    }
  }

  function isTabbableRadio(node) {
    if (!node.name) return true;
    // This won't account for the edge case where you have radio groups with the same
    // in separate forms on the same page.
    var radioSet = node.ownerDocument.querySelectorAll('input[type="radio"][name="' + node.name + '"]');
    var checked = getCheckedRadio(radioSet);
    return !checked || checked === node;
  }

  function isHidden(node) {
    // offsetParent being null will allow detecting cases where an element is invisible or inside an invisible element,
    // as long as the element does not use position: fixed. For them, their visibility has to be checked directly as well.
    return node.offsetParent === null || getComputedStyle(node).visibility === 'hidden';
  }

  var tabbable_1 = tabbable;

  var immutable = extend;

  var hasOwnProperty = Object.prototype.hasOwnProperty;

  function extend() {
      var target = {};

      for (var i = 0; i < arguments.length; i++) {
          var source = arguments[i];

          for (var key in source) {
              if (hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
              }
          }
      }

      return target
  }

  var activeFocusDelay;

  var activeFocusTraps = (function() {
    var trapQueue = [];
    return {
      activateTrap: function(trap) {
        if (trapQueue.length > 0) {
          var activeTrap = trapQueue[trapQueue.length - 1];
          if (activeTrap !== trap) {
            activeTrap.pause();
          }
        }

        var trapIndex = trapQueue.indexOf(trap);
        if (trapIndex === -1) {
          trapQueue.push(trap);
        } else {
          // move this existing trap to the front of the queue
          trapQueue.splice(trapIndex, 1);
          trapQueue.push(trap);
        }
      },

      deactivateTrap: function(trap) {
        var trapIndex = trapQueue.indexOf(trap);
        if (trapIndex !== -1) {
          trapQueue.splice(trapIndex, 1);
        }

        if (trapQueue.length > 0) {
          trapQueue[trapQueue.length - 1].unpause();
        }
      }
    };
  })();

  function focusTrap(element, userOptions) {
    var doc = document;
    var container =
      typeof element === 'string' ? doc.querySelector(element) : element;

    var config = immutable(
      {
        returnFocusOnDeactivate: true,
        escapeDeactivates: true
      },
      userOptions
    );

    var state = {
      firstTabbableNode: null,
      lastTabbableNode: null,
      nodeFocusedBeforeActivation: null,
      mostRecentlyFocusedNode: null,
      active: false,
      paused: false
    };

    var trap = {
      activate: activate,
      deactivate: deactivate,
      pause: pause,
      unpause: unpause
    };

    return trap;

    function activate(activateOptions) {
      if (state.active) return;

      updateTabbableNodes();

      state.active = true;
      state.paused = false;
      state.nodeFocusedBeforeActivation = doc.activeElement;

      var onActivate =
        activateOptions && activateOptions.onActivate
          ? activateOptions.onActivate
          : config.onActivate;
      if (onActivate) {
        onActivate();
      }

      addListeners();
      return trap;
    }

    function deactivate(deactivateOptions) {
      if (!state.active) return;

      clearTimeout(activeFocusDelay);

      removeListeners();
      state.active = false;
      state.paused = false;

      activeFocusTraps.deactivateTrap(trap);

      var onDeactivate =
        deactivateOptions && deactivateOptions.onDeactivate !== undefined
          ? deactivateOptions.onDeactivate
          : config.onDeactivate;
      if (onDeactivate) {
        onDeactivate();
      }

      var returnFocus =
        deactivateOptions && deactivateOptions.returnFocus !== undefined
          ? deactivateOptions.returnFocus
          : config.returnFocusOnDeactivate;
      if (returnFocus) {
        delay(function() {
          tryFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation));
        });
      }

      return trap;
    }

    function pause() {
      if (state.paused || !state.active) return;
      state.paused = true;
      removeListeners();
    }

    function unpause() {
      if (!state.paused || !state.active) return;
      state.paused = false;
      updateTabbableNodes();
      addListeners();
    }

    function addListeners() {
      if (!state.active) return;

      // There can be only one listening focus trap at a time
      activeFocusTraps.activateTrap(trap);

      // Delay ensures that the focused element doesn't capture the event
      // that caused the focus trap activation.
      activeFocusDelay = delay(function() {
        tryFocus(getInitialFocusNode());
      });

      doc.addEventListener('focusin', checkFocusIn, true);
      doc.addEventListener('mousedown', checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener('touchstart', checkPointerDown, {
        capture: true,
        passive: false
      });
      doc.addEventListener('click', checkClick, {
        capture: true,
        passive: false
      });
      doc.addEventListener('keydown', checkKey, {
        capture: true,
        passive: false
      });

      return trap;
    }

    function removeListeners() {
      if (!state.active) return;

      doc.removeEventListener('focusin', checkFocusIn, true);
      doc.removeEventListener('mousedown', checkPointerDown, true);
      doc.removeEventListener('touchstart', checkPointerDown, true);
      doc.removeEventListener('click', checkClick, true);
      doc.removeEventListener('keydown', checkKey, true);

      return trap;
    }

    function getNodeForOption(optionName) {
      var optionValue = config[optionName];
      var node = optionValue;
      if (!optionValue) {
        return null;
      }
      if (typeof optionValue === 'string') {
        node = doc.querySelector(optionValue);
        if (!node) {
          throw new Error('`' + optionName + '` refers to no known node');
        }
      }
      if (typeof optionValue === 'function') {
        node = optionValue();
        if (!node) {
          throw new Error('`' + optionName + '` did not return a node');
        }
      }
      return node;
    }

    function getInitialFocusNode() {
      var node;
      if (getNodeForOption('initialFocus') !== null) {
        node = getNodeForOption('initialFocus');
      } else if (container.contains(doc.activeElement)) {
        node = doc.activeElement;
      } else {
        node = state.firstTabbableNode || getNodeForOption('fallbackFocus');
      }

      if (!node) {
        throw new Error(
          'Your focus-trap needs to have at least one focusable element'
        );
      }

      return node;
    }

    function getReturnFocusNode(previousActiveElement) {
      var node = getNodeForOption('setReturnFocus');
      return node ? node : previousActiveElement;
    }

    // This needs to be done on mousedown and touchstart instead of click
    // so that it precedes the focus event.
    function checkPointerDown(e) {
      if (container.contains(e.target)) return;
      if (config.clickOutsideDeactivates) {
        deactivate({
          returnFocus: !tabbable_1.isFocusable(e.target)
        });
        return;
      }
      // This is needed for mobile devices.
      // (If we'll only let `click` events through,
      // then on mobile they will be blocked anyways if `touchstart` is blocked.)
      if (config.allowOutsideClick && config.allowOutsideClick(e)) {
        return;
      }
      e.preventDefault();
    }

    // In case focus escapes the trap for some strange reason, pull it back in.
    function checkFocusIn(e) {
      // In Firefox when you Tab out of an iframe the Document is briefly focused.
      if (container.contains(e.target) || e.target instanceof Document) {
        return;
      }
      e.stopImmediatePropagation();
      tryFocus(state.mostRecentlyFocusedNode || getInitialFocusNode());
    }

    function checkKey(e) {
      if (config.escapeDeactivates !== false && isEscapeEvent(e)) {
        e.preventDefault();
        deactivate();
        return;
      }
      if (isTabEvent(e)) {
        checkTab(e);
        return;
      }
    }

    // Hijack Tab events on the first and last focusable nodes of the trap,
    // in order to prevent focus from escaping. If it escapes for even a
    // moment it can end up scrolling the page and causing confusion so we
    // kind of need to capture the action at the keydown phase.
    function checkTab(e) {
      updateTabbableNodes();
      if (e.shiftKey && e.target === state.firstTabbableNode) {
        e.preventDefault();
        tryFocus(state.lastTabbableNode);
        return;
      }
      if (!e.shiftKey && e.target === state.lastTabbableNode) {
        e.preventDefault();
        tryFocus(state.firstTabbableNode);
        return;
      }
    }

    function checkClick(e) {
      if (config.clickOutsideDeactivates) return;
      if (container.contains(e.target)) return;
      if (config.allowOutsideClick && config.allowOutsideClick(e)) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    function updateTabbableNodes() {
      var tabbableNodes = tabbable_1(container);
      state.firstTabbableNode = tabbableNodes[0] || getInitialFocusNode();
      state.lastTabbableNode =
        tabbableNodes[tabbableNodes.length - 1] || getInitialFocusNode();
    }

    function tryFocus(node) {
      if (node === doc.activeElement) return;
      if (!node || !node.focus) {
        tryFocus(getInitialFocusNode());
        return;
      }
      node.focus();
      state.mostRecentlyFocusedNode = node;
      if (isSelectableInput(node)) {
        node.select();
      }
    }
  }

  function isSelectableInput(node) {
    return (
      node.tagName &&
      node.tagName.toLowerCase() === 'input' &&
      typeof node.select === 'function'
    );
  }

  function isEscapeEvent(e) {
    return e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
  }

  function isTabEvent(e) {
    return e.key === 'Tab' || e.keyCode === 9;
  }

  function delay(fn) {
    return setTimeout(fn, 0);
  }

  var focusTrap_1 = focusTrap;

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  function createFocusTrapInstance(surfaceEl, focusTrapFactory) {
      if (focusTrapFactory === void 0) { focusTrapFactory = focusTrap_1; }
      return focusTrapFactory(surfaceEl, {
          clickOutsideDeactivates: true,
          escapeDeactivates: false,
          initialFocus: undefined,
          returnFocusOnDeactivate: false,
      });
  }
  //# sourceMappingURL=util.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$6 = {
      ANIMATE: 'mdc-drawer--animate',
      CLOSING: 'mdc-drawer--closing',
      DISMISSIBLE: 'mdc-drawer--dismissible',
      MODAL: 'mdc-drawer--modal',
      OPEN: 'mdc-drawer--open',
      OPENING: 'mdc-drawer--opening',
      ROOT: 'mdc-drawer',
  };
  var strings$7 = {
      APP_CONTENT_SELECTOR: '.mdc-drawer-app-content',
      CLOSE_EVENT: 'MDCDrawer:closed',
      OPEN_EVENT: 'MDCDrawer:opened',
      SCRIM_SELECTOR: '.mdc-drawer-scrim',
  };
  //# sourceMappingURL=constants.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var MDCDismissibleDrawerFoundation = /** @class */ (function (_super) {
      __extends(MDCDismissibleDrawerFoundation, _super);
      function MDCDismissibleDrawerFoundation(adapter) {
          var _this = _super.call(this, __assign({}, MDCDismissibleDrawerFoundation.defaultAdapter, adapter)) || this;
          _this.animationFrame_ = 0;
          _this.animationTimer_ = 0;
          return _this;
      }
      Object.defineProperty(MDCDismissibleDrawerFoundation, "strings", {
          get: function () {
              return strings$7;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCDismissibleDrawerFoundation, "cssClasses", {
          get: function () {
              return cssClasses$6;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCDismissibleDrawerFoundation, "defaultAdapter", {
          get: function () {
              // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
              return {
                  addClass: function () { return undefined; },
                  removeClass: function () { return undefined; },
                  hasClass: function () { return false; },
                  elementHasClass: function () { return false; },
                  notifyClose: function () { return undefined; },
                  notifyOpen: function () { return undefined; },
                  saveFocus: function () { return undefined; },
                  restoreFocus: function () { return undefined; },
                  focusActiveNavigationItem: function () { return undefined; },
                  trapFocus: function () { return undefined; },
                  releaseFocus: function () { return undefined; },
              };
              // tslint:enable:object-literal-sort-keys
          },
          enumerable: true,
          configurable: true
      });
      MDCDismissibleDrawerFoundation.prototype.destroy = function () {
          if (this.animationFrame_) {
              cancelAnimationFrame(this.animationFrame_);
          }
          if (this.animationTimer_) {
              clearTimeout(this.animationTimer_);
          }
      };
      /**
       * Opens the drawer from the closed state.
       */
      MDCDismissibleDrawerFoundation.prototype.open = function () {
          var _this = this;
          if (this.isOpen() || this.isOpening() || this.isClosing()) {
              return;
          }
          this.adapter_.addClass(cssClasses$6.OPEN);
          this.adapter_.addClass(cssClasses$6.ANIMATE);
          // Wait a frame once display is no longer "none", to establish basis for animation
          this.runNextAnimationFrame_(function () {
              _this.adapter_.addClass(cssClasses$6.OPENING);
          });
          this.adapter_.saveFocus();
      };
      /**
       * Closes the drawer from the open state.
       */
      MDCDismissibleDrawerFoundation.prototype.close = function () {
          if (!this.isOpen() || this.isOpening() || this.isClosing()) {
              return;
          }
          this.adapter_.addClass(cssClasses$6.CLOSING);
      };
      /**
       * Returns true if the drawer is in the open position.
       * @return true if drawer is in open state.
       */
      MDCDismissibleDrawerFoundation.prototype.isOpen = function () {
          return this.adapter_.hasClass(cssClasses$6.OPEN);
      };
      /**
       * Returns true if the drawer is animating open.
       * @return true if drawer is animating open.
       */
      MDCDismissibleDrawerFoundation.prototype.isOpening = function () {
          return this.adapter_.hasClass(cssClasses$6.OPENING) || this.adapter_.hasClass(cssClasses$6.ANIMATE);
      };
      /**
       * Returns true if the drawer is animating closed.
       * @return true if drawer is animating closed.
       */
      MDCDismissibleDrawerFoundation.prototype.isClosing = function () {
          return this.adapter_.hasClass(cssClasses$6.CLOSING);
      };
      /**
       * Keydown handler to close drawer when key is escape.
       */
      MDCDismissibleDrawerFoundation.prototype.handleKeydown = function (evt) {
          var keyCode = evt.keyCode, key = evt.key;
          var isEscape = key === 'Escape' || keyCode === 27;
          if (isEscape) {
              this.close();
          }
      };
      /**
       * Handles the `transitionend` event when the drawer finishes opening/closing.
       */
      MDCDismissibleDrawerFoundation.prototype.handleTransitionEnd = function (evt) {
          var OPENING = cssClasses$6.OPENING, CLOSING = cssClasses$6.CLOSING, OPEN = cssClasses$6.OPEN, ANIMATE = cssClasses$6.ANIMATE, ROOT = cssClasses$6.ROOT;
          // In Edge, transitionend on ripple pseudo-elements yields a target without classList, so check for Element first.
          var isRootElement = this.isElement_(evt.target) && this.adapter_.elementHasClass(evt.target, ROOT);
          if (!isRootElement) {
              return;
          }
          if (this.isClosing()) {
              this.adapter_.removeClass(OPEN);
              this.closed_();
              this.adapter_.restoreFocus();
              this.adapter_.notifyClose();
          }
          else {
              this.adapter_.focusActiveNavigationItem();
              this.opened_();
              this.adapter_.notifyOpen();
          }
          this.adapter_.removeClass(ANIMATE);
          this.adapter_.removeClass(OPENING);
          this.adapter_.removeClass(CLOSING);
      };
      /**
       * Extension point for when drawer finishes open animation.
       */
      MDCDismissibleDrawerFoundation.prototype.opened_ = function () { }; // tslint:disable-line:no-empty
      /**
       * Extension point for when drawer finishes close animation.
       */
      MDCDismissibleDrawerFoundation.prototype.closed_ = function () { }; // tslint:disable-line:no-empty
      /**
       * Runs the given logic on the next animation frame, using setTimeout to factor in Firefox reflow behavior.
       */
      MDCDismissibleDrawerFoundation.prototype.runNextAnimationFrame_ = function (callback) {
          var _this = this;
          cancelAnimationFrame(this.animationFrame_);
          this.animationFrame_ = requestAnimationFrame(function () {
              _this.animationFrame_ = 0;
              clearTimeout(_this.animationTimer_);
              _this.animationTimer_ = setTimeout(callback, 0);
          });
      };
      MDCDismissibleDrawerFoundation.prototype.isElement_ = function (element) {
          // In Edge, transitionend on ripple pseudo-elements yields a target without classList.
          return Boolean(element.classList);
      };
      return MDCDismissibleDrawerFoundation;
  }(MDCFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  /* istanbul ignore next: subclass is not a branch statement */
  var MDCModalDrawerFoundation = /** @class */ (function (_super) {
      __extends(MDCModalDrawerFoundation, _super);
      function MDCModalDrawerFoundation() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      /**
       * Handles click event on scrim.
       */
      MDCModalDrawerFoundation.prototype.handleScrimClick = function () {
          this.close();
      };
      /**
       * Called when drawer finishes open animation.
       */
      MDCModalDrawerFoundation.prototype.opened_ = function () {
          this.adapter_.trapFocus();
      };
      /**
       * Called when drawer finishes close animation.
       */
      MDCModalDrawerFoundation.prototype.closed_ = function () {
          this.adapter_.releaseFocus();
      };
      return MDCModalDrawerFoundation;
  }(MDCDismissibleDrawerFoundation));
  //# sourceMappingURL=foundation.js.map

  /**
   * @license
   * Copyright 2016 Google Inc.
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */
  var cssClasses$7 = MDCDismissibleDrawerFoundation.cssClasses, strings$8 = MDCDismissibleDrawerFoundation.strings;
  /**
   * @events `MDCDrawer:closed {}` Emits when the navigation drawer has closed.
   * @events `MDCDrawer:opened {}` Emits when the navigation drawer has opened.
   */
  var MDCDrawer = /** @class */ (function (_super) {
      __extends(MDCDrawer, _super);
      function MDCDrawer() {
          return _super !== null && _super.apply(this, arguments) || this;
      }
      MDCDrawer.attachTo = function (root) {
          return new MDCDrawer(root);
      };
      Object.defineProperty(MDCDrawer.prototype, "open", {
          /**
           * @return boolean Proxies to the foundation's `open`/`close` methods.
           * Also returns true if drawer is in the open position.
           */
          get: function () {
              return this.foundation_.isOpen();
          },
          /**
           * Toggles the drawer open and closed.
           */
          set: function (isOpen) {
              if (isOpen) {
                  this.foundation_.open();
              }
              else {
                  this.foundation_.close();
              }
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(MDCDrawer.prototype, "list", {
          get: function () {
              return this.list_;
          },
          enumerable: true,
          configurable: true
      });
      MDCDrawer.prototype.initialize = function (focusTrapFactory, listFactory) {
          if (focusTrapFactory === void 0) { focusTrapFactory = focusTrap_1; }
          if (listFactory === void 0) { listFactory = function (el) { return new MDCList(el); }; }
          var listEl = this.root_.querySelector("." + MDCListFoundation.cssClasses.ROOT);
          if (listEl) {
              this.list_ = listFactory(listEl);
              this.list_.wrapFocus = true;
          }
          this.focusTrapFactory_ = focusTrapFactory;
      };
      MDCDrawer.prototype.initialSyncWithDOM = function () {
          var _this = this;
          var MODAL = cssClasses$7.MODAL;
          var SCRIM_SELECTOR = strings$8.SCRIM_SELECTOR;
          this.scrim_ = this.root_.parentNode.querySelector(SCRIM_SELECTOR);
          if (this.scrim_ && this.root_.classList.contains(MODAL)) {
              this.handleScrimClick_ = function () { return _this.foundation_.handleScrimClick(); };
              this.scrim_.addEventListener('click', this.handleScrimClick_);
              this.focusTrap_ = createFocusTrapInstance(this.root_, this.focusTrapFactory_);
          }
          this.handleKeydown_ = function (evt) { return _this.foundation_.handleKeydown(evt); };
          this.handleTransitionEnd_ = function (evt) { return _this.foundation_.handleTransitionEnd(evt); };
          this.listen('keydown', this.handleKeydown_);
          this.listen('transitionend', this.handleTransitionEnd_);
      };
      MDCDrawer.prototype.destroy = function () {
          this.unlisten('keydown', this.handleKeydown_);
          this.unlisten('transitionend', this.handleTransitionEnd_);
          if (this.list_) {
              this.list_.destroy();
          }
          var MODAL = cssClasses$7.MODAL;
          if (this.scrim_ && this.handleScrimClick_ && this.root_.classList.contains(MODAL)) {
              this.scrim_.removeEventListener('click', this.handleScrimClick_);
              // Ensure drawer is closed to hide scrim and release focus
              this.open = false;
          }
      };
      MDCDrawer.prototype.getDefaultFoundation = function () {
          var _this = this;
          // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
          // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
          // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
          var adapter = {
              addClass: function (className) { return _this.root_.classList.add(className); },
              removeClass: function (className) { return _this.root_.classList.remove(className); },
              hasClass: function (className) { return _this.root_.classList.contains(className); },
              elementHasClass: function (element, className) { return element.classList.contains(className); },
              saveFocus: function () { return _this.previousFocus_ = document.activeElement; },
              restoreFocus: function () {
                  var previousFocus = _this.previousFocus_;
                  if (previousFocus && previousFocus.focus && _this.root_.contains(document.activeElement)) {
                      previousFocus.focus();
                  }
              },
              focusActiveNavigationItem: function () {
                  var activeNavItemEl = _this.root_.querySelector("." + MDCListFoundation.cssClasses.LIST_ITEM_ACTIVATED_CLASS);
                  if (activeNavItemEl) {
                      activeNavItemEl.focus();
                  }
              },
              notifyClose: function () { return _this.emit(strings$8.CLOSE_EVENT, {}, true /* shouldBubble */); },
              notifyOpen: function () { return _this.emit(strings$8.OPEN_EVENT, {}, true /* shouldBubble */); },
              trapFocus: function () { return _this.focusTrap_.activate(); },
              releaseFocus: function () { return _this.focusTrap_.deactivate(); },
          };
          // tslint:enable:object-literal-sort-keys
          var DISMISSIBLE = cssClasses$7.DISMISSIBLE, MODAL = cssClasses$7.MODAL;
          if (this.root_.classList.contains(DISMISSIBLE)) {
              return new MDCDismissibleDrawerFoundation(adapter);
          }
          else if (this.root_.classList.contains(MODAL)) {
              return new MDCModalDrawerFoundation(adapter);
          }
          else {
              throw new Error("MDCDrawer: Failed to instantiate component. Supported variants are " + DISMISSIBLE + " and " + MODAL + ".");
          }
      };
      return MDCDrawer;
  }(MDCComponent));
  //# sourceMappingURL=component.js.map

  /* node_modules/@smui/drawer/Drawer.svelte generated by Svelte v3.16.7 */
  const file$a = "node_modules/@smui/drawer/Drawer.svelte";

  function create_fragment$c(ctx) {
  	let aside;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[14].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

  	let aside_levels = [
  		{
  			class: "\n    mdc-drawer\n    " + /*className*/ ctx[1] + "\n    " + (/*variant*/ ctx[2] === "dismissible"
  			? "mdc-drawer--dismissible"
  			: "") + "\n    " + (/*variant*/ ctx[2] === "modal"
  			? "mdc-drawer--modal"
  			: "") + "\n  "
  		},
  		exclude(/*$$props*/ ctx[6], ["use", "class", "variant", "open"])
  	];

  	let aside_data = {};

  	for (let i = 0; i < aside_levels.length; i += 1) {
  		aside_data = assign(aside_data, aside_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			aside = element("aside");
  			if (default_slot) default_slot.c();
  			set_attributes(aside, aside_data);
  			add_location(aside, file$a, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, aside, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[4].call(null, aside)),
  				listen_dev(aside, "MDCDrawer:opened", /*updateOpen*/ ctx[5], false, false, false),
  				listen_dev(aside, "MDCDrawer:closed", /*updateOpen*/ ctx[5], false, false, false)
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, aside, anchor);

  			if (default_slot) {
  				default_slot.m(aside, null);
  			}

  			/*aside_binding*/ ctx[15](aside);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8192) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[13], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null));
  			}

  			set_attributes(aside, get_spread_update(aside_levels, [
  				dirty & /*className, variant*/ 6 && ({
  					class: "\n    mdc-drawer\n    " + /*className*/ ctx[1] + "\n    " + (/*variant*/ ctx[2] === "dismissible"
  					? "mdc-drawer--dismissible"
  					: "") + "\n    " + (/*variant*/ ctx[2] === "modal"
  					? "mdc-drawer--modal"
  					: "") + "\n  "
  				}),
  				dirty & /*exclude, $$props*/ 64 && exclude(/*$$props*/ ctx[6], ["use", "class", "variant", "open"])
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(aside);
  			if (default_slot) default_slot.d(detaching);
  			/*aside_binding*/ ctx[15](null);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$c.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$c($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component, ["MDCDrawer:opened", "MDCDrawer:closed"]);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { variant = null } = $$props;
  	let { open = false } = $$props;
  	let element;
  	let drawer;
  	let listPromiseResolve;
  	let listPromise = new Promise(resolve => listPromiseResolve = resolve);
  	setContext("SMUI:list:nav", true);
  	setContext("SMUI:list:item:nav", true);

  	if (variant === "dismissible" || variant === "modal") {
  		setContext("SMUI:list:instantiate", false);
  		setContext("SMUI:list:getInstance", getListInstancePromise);
  	}

  	onMount(() => {
  		if (variant === "dismissible" || variant === "modal") {
  			$$invalidate(9, drawer = new MDCDrawer(element));
  			listPromiseResolve(drawer.list_);
  		}
  	});

  	onDestroy(() => {
  		drawer && drawer.destroy();
  	});

  	afterUpdate(() => {
  		if (drawer && !(variant === "dismissible" || variant === "modal")) {
  			drawer.destroy();
  			$$invalidate(9, drawer = undefined);
  		} else if (!drawer && (variant === "dismissible" || variant === "modal")) {
  			$$invalidate(9, drawer = new MDCDrawer(element));
  			listPromiseResolve(drawer.list_);
  		}
  	});

  	function getListInstancePromise() {
  		return listPromise;
  	}

  	function updateOpen() {
  		$$invalidate(7, open = drawer.open);
  	}

  	function setOpen(value) {
  		$$invalidate(7, open = value);
  	}

  	let { $$slots = {}, $$scope } = $$props;

  	function aside_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(3, element = $$value);
  		});
  	}

  	$$self.$set = $$new_props => {
  		$$invalidate(6, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("variant" in $$new_props) $$invalidate(2, variant = $$new_props.variant);
  		if ("open" in $$new_props) $$invalidate(7, open = $$new_props.open);
  		if ("$$scope" in $$new_props) $$invalidate(13, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			variant,
  			open,
  			element,
  			drawer,
  			listPromiseResolve,
  			listPromise
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(6, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("variant" in $$props) $$invalidate(2, variant = $$new_props.variant);
  		if ("open" in $$props) $$invalidate(7, open = $$new_props.open);
  		if ("element" in $$props) $$invalidate(3, element = $$new_props.element);
  		if ("drawer" in $$props) $$invalidate(9, drawer = $$new_props.drawer);
  		if ("listPromiseResolve" in $$props) listPromiseResolve = $$new_props.listPromiseResolve;
  		if ("listPromise" in $$props) listPromise = $$new_props.listPromise;
  	};

  	$$self.$$.update = () => {
  		if ($$self.$$.dirty & /*drawer, open*/ 640) {
  			 if (drawer && drawer.open !== open) {
  				$$invalidate(9, drawer.open = open, drawer);
  			}
  		}
  	};

  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		variant,
  		element,
  		forwardEvents,
  		updateOpen,
  		$$props,
  		open,
  		setOpen,
  		drawer,
  		listPromiseResolve,
  		listPromise,
  		getListInstancePromise,
  		$$scope,
  		$$slots,
  		aside_binding
  	];
  }

  class Drawer extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
  			use: 0,
  			class: 1,
  			variant: 2,
  			open: 7,
  			setOpen: 8
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Drawer",
  			options,
  			id: create_fragment$c.name
  		});
  	}

  	get use() {
  		throw new Error("<Drawer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Drawer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Drawer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Drawer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get variant() {
  		throw new Error("<Drawer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set variant(value) {
  		throw new Error("<Drawer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get open() {
  		throw new Error("<Drawer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set open(value) {
  		throw new Error("<Drawer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get setOpen() {
  		return this.$$.ctx[8];
  	}

  	set setOpen(value) {
  		throw new Error("<Drawer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  classAdderBuilder({
    class: 'mdc-drawer-app-content',
    component: Div,
    contexts: {}
  });

  var Content = classAdderBuilder({
    class: 'mdc-drawer__content',
    component: Div,
    contexts: {}
  });

  var Header = classAdderBuilder({
    class: 'mdc-drawer__header',
    component: Div,
    contexts: {}
  });

  /* node_modules/@smui/common/H1.svelte generated by Svelte v3.16.7 */
  const file$b = "node_modules/@smui/common/H1.svelte";

  function create_fragment$d(ctx) {
  	let h1;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[4].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
  	let h1_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
  	let h1_data = {};

  	for (let i = 0; i < h1_levels.length; i += 1) {
  		h1_data = assign(h1_data, h1_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			h1 = element("h1");
  			if (default_slot) default_slot.c();
  			set_attributes(h1, h1_data);
  			add_location(h1, file$b, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, h1, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, h1))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h1, anchor);

  			if (default_slot) {
  				default_slot.m(h1, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
  			}

  			set_attributes(h1, get_spread_update(h1_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h1);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$d.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$d($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, forwardEvents, $$props, $$scope, $$slots];
  }

  class H1 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$d, create_fragment$d, safe_not_equal, { use: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "H1",
  			options,
  			id: create_fragment$d.name
  		});
  	}

  	get use() {
  		throw new Error("<H1>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<H1>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  classAdderBuilder({
    class: 'mdc-drawer__title',
    component: H1,
    contexts: {}
  });

  /* node_modules/@smui/common/H2.svelte generated by Svelte v3.16.7 */
  const file$c = "node_modules/@smui/common/H2.svelte";

  function create_fragment$e(ctx) {
  	let h2;
  	let useActions_action;
  	let forwardEvents_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[4].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
  	let h2_levels = [exclude(/*$$props*/ ctx[2], ["use"])];
  	let h2_data = {};

  	for (let i = 0; i < h2_levels.length; i += 1) {
  		h2_data = assign(h2_data, h2_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			h2 = element("h2");
  			if (default_slot) default_slot.c();
  			set_attributes(h2, h2_data);
  			add_location(h2, file$c, 0, 0, 0);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, h2, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[1].call(null, h2))
  			];
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h2, anchor);

  			if (default_slot) {
  				default_slot.m(h2, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 8) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[3], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null));
  			}

  			set_attributes(h2, get_spread_update(h2_levels, [dirty & /*exclude, $$props*/ 4 && exclude(/*$$props*/ ctx[2], ["use"])]));
  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h2);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$e.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$e($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("$$scope" in $$new_props) $$invalidate(3, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { use };
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  	};

  	$$props = exclude_internal_props($$props);
  	return [use, forwardEvents, $$props, $$scope, $$slots];
  }

  class H2 extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$e, create_fragment$e, safe_not_equal, { use: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "H2",
  			options,
  			id: create_fragment$e.name
  		});
  	}

  	get use() {
  		throw new Error("<H2>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<H2>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var Subtitle = classAdderBuilder({
    class: 'mdc-drawer__subtitle',
    component: H2,
    contexts: {}
  });

  classAdderBuilder({
    class: 'mdc-drawer-scrim',
    component: Div,
    contexts: {}
  });

  const subscriber_queue = [];
  /**
   * Create a `Writable` store that allows both updating and reading by subscription.
   * @param {*=}value initial value
   * @param {StartStopNotifier=}start start and stop notifications for subscriptions
   */
  function writable(value, start = noop) {
      let stop;
      const subscribers = [];
      function set(new_value) {
          if (safe_not_equal(value, new_value)) {
              value = new_value;
              if (stop) { // store is ready
                  const run_queue = !subscriber_queue.length;
                  for (let i = 0; i < subscribers.length; i += 1) {
                      const s = subscribers[i];
                      s[1]();
                      subscriber_queue.push(s, value);
                  }
                  if (run_queue) {
                      for (let i = 0; i < subscriber_queue.length; i += 2) {
                          subscriber_queue[i][0](subscriber_queue[i + 1]);
                      }
                      subscriber_queue.length = 0;
                  }
              }
          }
      }
      function update(fn) {
          set(fn(value));
      }
      function subscribe(run, invalidate = noop) {
          const subscriber = [run, invalidate];
          subscribers.push(subscriber);
          if (subscribers.length === 1) {
              stop = start(set) || noop;
          }
          run(value);
          return () => {
              const index = subscribers.indexOf(subscriber);
              if (index !== -1) {
                  subscribers.splice(index, 1);
              }
              if (subscribers.length === 0) {
                  stop();
                  stop = null;
              }
          };
      }
      return { set, update, subscribe };
  }

  const myStore = writable(10);

  /* node_modules/@smui/button/Button.svelte generated by Svelte v3.16.7 */
  const file$d = "node_modules/@smui/button/Button.svelte";

  // (26:0) {:else}
  function create_else_block$3(ctx) {
  	let button;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[17].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

  	let button_levels = [
  		{
  			class: "\n      mdc-button\n      " + /*className*/ ctx[1] + "\n      " + (/*variant*/ ctx[4] === "raised"
  			? "mdc-button--raised"
  			: "") + "\n      " + (/*variant*/ ctx[4] === "unelevated"
  			? "mdc-button--unelevated"
  			: "") + "\n      " + (/*variant*/ ctx[4] === "outlined"
  			? "mdc-button--outlined"
  			: "") + "\n      " + (/*dense*/ ctx[5] ? "mdc-button--dense" : "") + "\n      " + (/*color*/ ctx[3] === "secondary"
  			? "smui-button--color-secondary"
  			: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  			? "mdc-card__action"
  			: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  			? "mdc-card__action--button"
  			: "") + "\n      " + (/*context*/ ctx[11] === "dialog:action"
  			? "mdc-dialog__button"
  			: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:navigation"
  			? "mdc-top-app-bar__navigation-icon"
  			: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:action"
  			? "mdc-top-app-bar__action-item"
  			: "") + "\n      " + (/*context*/ ctx[11] === "snackbar"
  			? "mdc-snackbar__action"
  			: "") + "\n    "
  		},
  		/*actionProp*/ ctx[8],
  		/*defaultProp*/ ctx[9],
  		/*props*/ ctx[7]
  	];

  	let button_data = {};

  	for (let i = 0; i < button_levels.length; i += 1) {
  		button_data = assign(button_data, button_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			button = element("button");
  			if (default_slot) default_slot.c();
  			set_attributes(button, button_data);
  			add_location(button, file$d, 26, 2, 971);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, button, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, button)),
  				action_destroyer(Ripple_action = Ripple.call(null, button, [/*ripple*/ ctx[2], { unbounded: false }]))
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, button, anchor);

  			if (default_slot) {
  				default_slot.m(button, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 65536) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[16], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null));
  			}

  			set_attributes(button, get_spread_update(button_levels, [
  				dirty & /*className, variant, dense, color, context*/ 2106 && ({
  					class: "\n      mdc-button\n      " + /*className*/ ctx[1] + "\n      " + (/*variant*/ ctx[4] === "raised"
  					? "mdc-button--raised"
  					: "") + "\n      " + (/*variant*/ ctx[4] === "unelevated"
  					? "mdc-button--unelevated"
  					: "") + "\n      " + (/*variant*/ ctx[4] === "outlined"
  					? "mdc-button--outlined"
  					: "") + "\n      " + (/*dense*/ ctx[5] ? "mdc-button--dense" : "") + "\n      " + (/*color*/ ctx[3] === "secondary"
  					? "smui-button--color-secondary"
  					: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  					? "mdc-card__action"
  					: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  					? "mdc-card__action--button"
  					: "") + "\n      " + (/*context*/ ctx[11] === "dialog:action"
  					? "mdc-dialog__button"
  					: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:navigation"
  					? "mdc-top-app-bar__navigation-icon"
  					: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:action"
  					? "mdc-top-app-bar__action-item"
  					: "") + "\n      " + (/*context*/ ctx[11] === "snackbar"
  					? "mdc-snackbar__action"
  					: "") + "\n    "
  				}),
  				dirty & /*actionProp*/ 256 && /*actionProp*/ ctx[8],
  				dirty & /*defaultProp*/ 512 && /*defaultProp*/ ctx[9],
  				dirty & /*props*/ 128 && /*props*/ ctx[7]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple*/ 4) Ripple_action.update.call(null, [/*ripple*/ ctx[2], { unbounded: false }]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(button);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$3.name,
  		type: "else",
  		source: "(26:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (1:0) {#if href}
  function create_if_block$3(ctx) {
  	let a;
  	let useActions_action;
  	let forwardEvents_action;
  	let Ripple_action;
  	let current;
  	let dispose;
  	const default_slot_template = /*$$slots*/ ctx[17].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);

  	let a_levels = [
  		{
  			class: "\n      mdc-button\n      " + /*className*/ ctx[1] + "\n      " + (/*variant*/ ctx[4] === "raised"
  			? "mdc-button--raised"
  			: "") + "\n      " + (/*variant*/ ctx[4] === "unelevated"
  			? "mdc-button--unelevated"
  			: "") + "\n      " + (/*variant*/ ctx[4] === "outlined"
  			? "mdc-button--outlined"
  			: "") + "\n      " + (/*dense*/ ctx[5] ? "mdc-button--dense" : "") + "\n      " + (/*color*/ ctx[3] === "secondary"
  			? "smui-button--color-secondary"
  			: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  			? "mdc-card__action"
  			: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  			? "mdc-card__action--button"
  			: "") + "\n      " + (/*context*/ ctx[11] === "dialog:action"
  			? "mdc-dialog__button"
  			: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:navigation"
  			? "mdc-top-app-bar__navigation-icon"
  			: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:action"
  			? "mdc-top-app-bar__action-item"
  			: "") + "\n      " + (/*context*/ ctx[11] === "snackbar"
  			? "mdc-snackbar__action"
  			: "") + "\n    "
  		},
  		{ href: /*href*/ ctx[6] },
  		/*actionProp*/ ctx[8],
  		/*defaultProp*/ ctx[9],
  		/*props*/ ctx[7]
  	];

  	let a_data = {};

  	for (let i = 0; i < a_levels.length; i += 1) {
  		a_data = assign(a_data, a_levels[i]);
  	}

  	const block = {
  		c: function create() {
  			a = element("a");
  			if (default_slot) default_slot.c();
  			set_attributes(a, a_data);
  			add_location(a, file$d, 1, 2, 13);

  			dispose = [
  				action_destroyer(useActions_action = useActions.call(null, a, /*use*/ ctx[0])),
  				action_destroyer(forwardEvents_action = /*forwardEvents*/ ctx[10].call(null, a)),
  				action_destroyer(Ripple_action = Ripple.call(null, a, [/*ripple*/ ctx[2], { unbounded: false }]))
  			];
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, a, anchor);

  			if (default_slot) {
  				default_slot.m(a, null);
  			}

  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 65536) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[16], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null));
  			}

  			set_attributes(a, get_spread_update(a_levels, [
  				dirty & /*className, variant, dense, color, context*/ 2106 && ({
  					class: "\n      mdc-button\n      " + /*className*/ ctx[1] + "\n      " + (/*variant*/ ctx[4] === "raised"
  					? "mdc-button--raised"
  					: "") + "\n      " + (/*variant*/ ctx[4] === "unelevated"
  					? "mdc-button--unelevated"
  					: "") + "\n      " + (/*variant*/ ctx[4] === "outlined"
  					? "mdc-button--outlined"
  					: "") + "\n      " + (/*dense*/ ctx[5] ? "mdc-button--dense" : "") + "\n      " + (/*color*/ ctx[3] === "secondary"
  					? "smui-button--color-secondary"
  					: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  					? "mdc-card__action"
  					: "") + "\n      " + (/*context*/ ctx[11] === "card:action"
  					? "mdc-card__action--button"
  					: "") + "\n      " + (/*context*/ ctx[11] === "dialog:action"
  					? "mdc-dialog__button"
  					: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:navigation"
  					? "mdc-top-app-bar__navigation-icon"
  					: "") + "\n      " + (/*context*/ ctx[11] === "top-app-bar:action"
  					? "mdc-top-app-bar__action-item"
  					: "") + "\n      " + (/*context*/ ctx[11] === "snackbar"
  					? "mdc-snackbar__action"
  					: "") + "\n    "
  				}),
  				dirty & /*href*/ 64 && ({ href: /*href*/ ctx[6] }),
  				dirty & /*actionProp*/ 256 && /*actionProp*/ ctx[8],
  				dirty & /*defaultProp*/ 512 && /*defaultProp*/ ctx[9],
  				dirty & /*props*/ 128 && /*props*/ ctx[7]
  			]));

  			if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
  			if (Ripple_action && is_function(Ripple_action.update) && dirty & /*ripple*/ 4) Ripple_action.update.call(null, [/*ripple*/ ctx[2], { unbounded: false }]);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(a);
  			if (default_slot) default_slot.d(detaching);
  			run_all(dispose);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$3.name,
  		type: "if",
  		source: "(1:0) {#if href}",
  		ctx
  	});

  	return block;
  }

  function create_fragment$f(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$3, create_else_block$3];
  	const if_blocks = [];

  	function select_block_type(ctx, dirty) {
  		if (/*href*/ ctx[6]) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(ctx, dirty);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$f.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$f($$self, $$props, $$invalidate) {
  	const forwardEvents = forwardEventsBuilder(current_component);
  	let { use = [] } = $$props;
  	let { class: className = "" } = $$props;
  	let { ripple = true } = $$props;
  	let { color = "primary" } = $$props;
  	let { variant = "text" } = $$props;
  	let { dense = false } = $$props;
  	let { href = null } = $$props;
  	let { action = "close" } = $$props;
  	let { default: defaultAction = false } = $$props;
  	let context = getContext("SMUI:button:context");
  	setContext("SMUI:label:context", "button");
  	setContext("SMUI:icon:context", "button");
  	let { $$slots = {}, $$scope } = $$props;

  	$$self.$set = $$new_props => {
  		$$invalidate(15, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
  		if ("use" in $$new_props) $$invalidate(0, use = $$new_props.use);
  		if ("class" in $$new_props) $$invalidate(1, className = $$new_props.class);
  		if ("ripple" in $$new_props) $$invalidate(2, ripple = $$new_props.ripple);
  		if ("color" in $$new_props) $$invalidate(3, color = $$new_props.color);
  		if ("variant" in $$new_props) $$invalidate(4, variant = $$new_props.variant);
  		if ("dense" in $$new_props) $$invalidate(5, dense = $$new_props.dense);
  		if ("href" in $$new_props) $$invalidate(6, href = $$new_props.href);
  		if ("action" in $$new_props) $$invalidate(12, action = $$new_props.action);
  		if ("default" in $$new_props) $$invalidate(13, defaultAction = $$new_props.default);
  		if ("$$scope" in $$new_props) $$invalidate(16, $$scope = $$new_props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return {
  			use,
  			className,
  			ripple,
  			color,
  			variant,
  			dense,
  			href,
  			action,
  			defaultAction,
  			context,
  			dialogExcludes,
  			props,
  			actionProp,
  			defaultProp
  		};
  	};

  	$$self.$inject_state = $$new_props => {
  		$$invalidate(15, $$props = assign(assign({}, $$props), $$new_props));
  		if ("use" in $$props) $$invalidate(0, use = $$new_props.use);
  		if ("className" in $$props) $$invalidate(1, className = $$new_props.className);
  		if ("ripple" in $$props) $$invalidate(2, ripple = $$new_props.ripple);
  		if ("color" in $$props) $$invalidate(3, color = $$new_props.color);
  		if ("variant" in $$props) $$invalidate(4, variant = $$new_props.variant);
  		if ("dense" in $$props) $$invalidate(5, dense = $$new_props.dense);
  		if ("href" in $$props) $$invalidate(6, href = $$new_props.href);
  		if ("action" in $$props) $$invalidate(12, action = $$new_props.action);
  		if ("defaultAction" in $$props) $$invalidate(13, defaultAction = $$new_props.defaultAction);
  		if ("context" in $$props) $$invalidate(11, context = $$new_props.context);
  		if ("dialogExcludes" in $$props) $$invalidate(14, dialogExcludes = $$new_props.dialogExcludes);
  		if ("props" in $$props) $$invalidate(7, props = $$new_props.props);
  		if ("actionProp" in $$props) $$invalidate(8, actionProp = $$new_props.actionProp);
  		if ("defaultProp" in $$props) $$invalidate(9, defaultProp = $$new_props.defaultProp);
  	};

  	let dialogExcludes;
  	let props;
  	let actionProp;
  	let defaultProp;

  	$$self.$$.update = () => {
  		 $$invalidate(7, props = exclude($$props, [
  			"use",
  			"class",
  			"ripple",
  			"color",
  			"variant",
  			"dense",
  			"href",
  			...dialogExcludes
  		]));

  		if ($$self.$$.dirty & /*action*/ 4096) {
  			 $$invalidate(8, actionProp = context === "dialog:action" && action !== null
  			? { "data-mdc-dialog-action": action }
  			: {});
  		}

  		if ($$self.$$.dirty & /*defaultAction*/ 8192) {
  			 $$invalidate(9, defaultProp = context === "dialog:action" && defaultAction
  			? { "data-mdc-dialog-button-default": "" }
  			: {});
  		}
  	};

  	 $$invalidate(14, dialogExcludes = context === "dialog:action" ? ["action", "default"] : []);
  	$$props = exclude_internal_props($$props);

  	return [
  		use,
  		className,
  		ripple,
  		color,
  		variant,
  		dense,
  		href,
  		props,
  		actionProp,
  		defaultProp,
  		forwardEvents,
  		context,
  		action,
  		defaultAction,
  		dialogExcludes,
  		$$props,
  		$$scope,
  		$$slots
  	];
  }

  class Button extends SvelteComponentDev {
  	constructor(options) {
  		super(options);

  		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
  			use: 0,
  			class: 1,
  			ripple: 2,
  			color: 3,
  			variant: 4,
  			dense: 5,
  			href: 6,
  			action: 12,
  			default: 13
  		});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Button",
  			options,
  			id: create_fragment$f.name
  		});
  	}

  	get use() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set use(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get class() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set class(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get ripple() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set ripple(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get color() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set color(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get variant() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set variant(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get dense() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set dense(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get href() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set href(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get action() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set action(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get default() {
  		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set default(value) {
  		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/Counter.svelte generated by Svelte v3.16.7 */
  const file$e = "src/Counter.svelte";

  // (14:45) <Icon class="material-icons">
  function create_default_slot_2(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("thumb_up");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_2.name,
  		type: "slot",
  		source: "(14:45) <Icon class=\\\"material-icons\\\">",
  		ctx
  	});

  	return block;
  }

  // (14:4) <Button on:click={() => (value += step)}>
  function create_default_slot_1(ctx) {
  	let t;
  	let current;

  	const icon = new Icon({
  			props: {
  				class: "material-icons",
  				$$slots: { default: [create_default_slot_2] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(icon.$$.fragment);
  			t = text("+");
  		},
  		m: function mount(target, anchor) {
  			mount_component(icon, target, anchor);
  			insert_dev(target, t, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const icon_changes = {};

  			if (dirty & /*$$scope*/ 32) {
  				icon_changes.$$scope = { dirty, ctx };
  			}

  			icon.$set(icon_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(icon.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(icon.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(icon, detaching);
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_1.name,
  		type: "slot",
  		source: "(14:4) <Button on:click={() => (value += step)}>",
  		ctx
  	});

  	return block;
  }

  // (15:4) <Button on:click={() => (value -= step)}>
  function create_default_slot$2(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("-");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$2.name,
  		type: "slot",
  		source: "(15:4) <Button on:click={() => (value -= step)}>",
  		ctx
  	});

  	return block;
  }

  function create_fragment$g(ctx) {
  	let div1;
  	let p;
  	let t0;
  	let t1;
  	let div0;
  	let b;
  	let t2;
  	let t3;
  	let t4;
  	let current;
  	const default_slot_template = /*$$slots*/ ctx[2].default;
  	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

  	const button0 = new Button({
  			props: {
  				$$slots: { default: [create_default_slot_1] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	button0.$on("click", /*click_handler*/ ctx[3]);

  	const button1 = new Button({
  			props: {
  				$$slots: { default: [create_default_slot$2] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	button1.$on("click", /*click_handler_1*/ ctx[4]);

  	const block = {
  		c: function create() {
  			div1 = element("div");
  			p = element("p");

  			if (!default_slot) {
  				t0 = text("Default Counter");
  			}

  			if (default_slot) default_slot.c();
  			t1 = space();
  			div0 = element("div");
  			b = element("b");
  			t2 = text(/*value*/ ctx[0]);
  			t3 = space();
  			create_component(button0.$$.fragment);
  			t4 = space();
  			create_component(button1.$$.fragment);
  			attr_dev(p, "class", "mdc-typography--body1");
  			add_location(p, file$e, 6, 2, 132);
  			add_location(b, file$e, 10, 5, 219);
  			add_location(div0, file$e, 9, 2, 208);
  			add_location(div1, file$e, 5, 0, 124);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div1, anchor);
  			append_dev(div1, p);

  			if (!default_slot) {
  				append_dev(p, t0);
  			}

  			if (default_slot) {
  				default_slot.m(p, null);
  			}

  			append_dev(div1, t1);
  			append_dev(div1, div0);
  			append_dev(div0, b);
  			append_dev(b, t2);
  			append_dev(div0, t3);
  			mount_component(button0, div0, null);
  			append_dev(div0, t4);
  			mount_component(button1, div0, null);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			if (default_slot && default_slot.p && dirty & /*$$scope*/ 32) {
  				default_slot.p(get_slot_context(default_slot_template, ctx, /*$$scope*/ ctx[5], null), get_slot_changes(default_slot_template, /*$$scope*/ ctx[5], dirty, null));
  			}

  			if (!current || dirty & /*value*/ 1) set_data_dev(t2, /*value*/ ctx[0]);
  			const button0_changes = {};

  			if (dirty & /*$$scope*/ 32) {
  				button0_changes.$$scope = { dirty, ctx };
  			}

  			button0.$set(button0_changes);
  			const button1_changes = {};

  			if (dirty & /*$$scope*/ 32) {
  				button1_changes.$$scope = { dirty, ctx };
  			}

  			button1.$set(button1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(default_slot, local);
  			transition_in(button0.$$.fragment, local);
  			transition_in(button1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(default_slot, local);
  			transition_out(button0.$$.fragment, local);
  			transition_out(button1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div1);
  			if (default_slot) default_slot.d(detaching);
  			destroy_component(button0);
  			destroy_component(button1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$g.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$g($$self, $$props, $$invalidate) {
  	let { value = 0 } = $$props;
  	let { step = 1 } = $$props;
  	const writable_props = ["value", "step"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Counter> was created with unknown prop '${key}'`);
  	});

  	let { $$slots = {}, $$scope } = $$props;
  	const click_handler = () => $$invalidate(0, value += step);
  	const click_handler_1 = () => $$invalidate(0, value -= step);

  	$$self.$set = $$props => {
  		if ("value" in $$props) $$invalidate(0, value = $$props.value);
  		if ("step" in $$props) $$invalidate(1, step = $$props.step);
  		if ("$$scope" in $$props) $$invalidate(5, $$scope = $$props.$$scope);
  	};

  	$$self.$capture_state = () => {
  		return { value, step };
  	};

  	$$self.$inject_state = $$props => {
  		if ("value" in $$props) $$invalidate(0, value = $$props.value);
  		if ("step" in $$props) $$invalidate(1, step = $$props.step);
  	};

  	return [value, step, $$slots, click_handler, click_handler_1, $$scope];
  }

  class Counter extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$g, create_fragment$g, safe_not_equal, { value: 0, step: 1 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Counter",
  			options,
  			id: create_fragment$g.name
  		});
  	}

  	get value() {
  		throw new Error("<Counter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set value(value) {
  		throw new Error("<Counter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get step() {
  		throw new Error("<Counter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set step(value) {
  		throw new Error("<Counter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var index_cjs = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, '__esModule', { value: true });



  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * @fileoverview Firebase constants.  Some of these (@defines) can be overridden at compile-time.
   */
  var CONSTANTS = {
      /**
       * @define {boolean} Whether this is the client Node.js SDK.
       */
      NODE_CLIENT: false,
      /**
       * @define {boolean} Whether this is the Admin Node.js SDK.
       */
      NODE_ADMIN: false,
      /**
       * Firebase SDK Version
       */
      SDK_VERSION: '${JSCORE_VERSION}'
  };

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Throws an error if the provided assertion is falsy
   */
  var assert = function (assertion, message) {
      if (!assertion) {
          throw assertionError(message);
      }
  };
  /**
   * Returns an Error object suitable for throwing.
   */
  var assertionError = function (message) {
      return new Error('Firebase Database (' +
          CONSTANTS.SDK_VERSION +
          ') INTERNAL ASSERT FAILED: ' +
          message);
  };

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var stringToByteArray = function (str) {
      // TODO(user): Use native implementations if/when available
      var out = [];
      var p = 0;
      for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i);
          if (c < 128) {
              out[p++] = c;
          }
          else if (c < 2048) {
              out[p++] = (c >> 6) | 192;
              out[p++] = (c & 63) | 128;
          }
          else if ((c & 0xfc00) === 0xd800 &&
              i + 1 < str.length &&
              (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
              // Surrogate Pair
              c = 0x10000 + ((c & 0x03ff) << 10) + (str.charCodeAt(++i) & 0x03ff);
              out[p++] = (c >> 18) | 240;
              out[p++] = ((c >> 12) & 63) | 128;
              out[p++] = ((c >> 6) & 63) | 128;
              out[p++] = (c & 63) | 128;
          }
          else {
              out[p++] = (c >> 12) | 224;
              out[p++] = ((c >> 6) & 63) | 128;
              out[p++] = (c & 63) | 128;
          }
      }
      return out;
  };
  /**
   * Turns an array of numbers into the string given by the concatenation of the
   * characters to which the numbers correspond.
   * @param bytes Array of numbers representing characters.
   * @return Stringification of the array.
   */
  var byteArrayToString = function (bytes) {
      // TODO(user): Use native implementations if/when available
      var out = [];
      var pos = 0, c = 0;
      while (pos < bytes.length) {
          var c1 = bytes[pos++];
          if (c1 < 128) {
              out[c++] = String.fromCharCode(c1);
          }
          else if (c1 > 191 && c1 < 224) {
              var c2 = bytes[pos++];
              out[c++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
          }
          else if (c1 > 239 && c1 < 365) {
              // Surrogate Pair
              var c2 = bytes[pos++];
              var c3 = bytes[pos++];
              var c4 = bytes[pos++];
              var u = (((c1 & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) -
                  0x10000;
              out[c++] = String.fromCharCode(0xd800 + (u >> 10));
              out[c++] = String.fromCharCode(0xdc00 + (u & 1023));
          }
          else {
              var c2 = bytes[pos++];
              var c3 = bytes[pos++];
              out[c++] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
          }
      }
      return out.join('');
  };
  // We define it as an object literal instead of a class because a class compiled down to es5 can't
  // be treeshaked. https://github.com/rollup/rollup/issues/1691
  // Static lookup maps, lazily populated by init_()
  var base64 = {
      /**
       * Maps bytes to characters.
       */
      byteToCharMap_: null,
      /**
       * Maps characters to bytes.
       */
      charToByteMap_: null,
      /**
       * Maps bytes to websafe characters.
       * @private
       */
      byteToCharMapWebSafe_: null,
      /**
       * Maps websafe characters to bytes.
       * @private
       */
      charToByteMapWebSafe_: null,
      /**
       * Our default alphabet, shared between
       * ENCODED_VALS and ENCODED_VALS_WEBSAFE
       */
      ENCODED_VALS_BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789',
      /**
       * Our default alphabet. Value 64 (=) is special; it means "nothing."
       */
      get ENCODED_VALS() {
          return this.ENCODED_VALS_BASE + '+/=';
      },
      /**
       * Our websafe alphabet.
       */
      get ENCODED_VALS_WEBSAFE() {
          return this.ENCODED_VALS_BASE + '-_.';
      },
      /**
       * Whether this browser supports the atob and btoa functions. This extension
       * started at Mozilla but is now implemented by many browsers. We use the
       * ASSUME_* variables to avoid pulling in the full useragent detection library
       * but still allowing the standard per-browser compilations.
       *
       */
      HAS_NATIVE_SUPPORT: typeof atob === 'function',
      /**
       * Base64-encode an array of bytes.
       *
       * @param input An array of bytes (numbers with
       *     value in [0, 255]) to encode.
       * @param webSafe Boolean indicating we should use the
       *     alternative alphabet.
       * @return The base64 encoded string.
       */
      encodeByteArray: function (input, webSafe) {
          if (!Array.isArray(input)) {
              throw Error('encodeByteArray takes an array as a parameter');
          }
          this.init_();
          var byteToCharMap = webSafe
              ? this.byteToCharMapWebSafe_
              : this.byteToCharMap_;
          var output = [];
          for (var i = 0; i < input.length; i += 3) {
              var byte1 = input[i];
              var haveByte2 = i + 1 < input.length;
              var byte2 = haveByte2 ? input[i + 1] : 0;
              var haveByte3 = i + 2 < input.length;
              var byte3 = haveByte3 ? input[i + 2] : 0;
              var outByte1 = byte1 >> 2;
              var outByte2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
              var outByte3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
              var outByte4 = byte3 & 0x3f;
              if (!haveByte3) {
                  outByte4 = 64;
                  if (!haveByte2) {
                      outByte3 = 64;
                  }
              }
              output.push(byteToCharMap[outByte1], byteToCharMap[outByte2], byteToCharMap[outByte3], byteToCharMap[outByte4]);
          }
          return output.join('');
      },
      /**
       * Base64-encode a string.
       *
       * @param input A string to encode.
       * @param webSafe If true, we should use the
       *     alternative alphabet.
       * @return The base64 encoded string.
       */
      encodeString: function (input, webSafe) {
          // Shortcut for Mozilla browsers that implement
          // a native base64 encoder in the form of "btoa/atob"
          if (this.HAS_NATIVE_SUPPORT && !webSafe) {
              return btoa(input);
          }
          return this.encodeByteArray(stringToByteArray(input), webSafe);
      },
      /**
       * Base64-decode a string.
       *
       * @param input to decode.
       * @param webSafe True if we should use the
       *     alternative alphabet.
       * @return string representing the decoded value.
       */
      decodeString: function (input, webSafe) {
          // Shortcut for Mozilla browsers that implement
          // a native base64 encoder in the form of "btoa/atob"
          if (this.HAS_NATIVE_SUPPORT && !webSafe) {
              return atob(input);
          }
          return byteArrayToString(this.decodeStringToByteArray(input, webSafe));
      },
      /**
       * Base64-decode a string.
       *
       * In base-64 decoding, groups of four characters are converted into three
       * bytes.  If the encoder did not apply padding, the input length may not
       * be a multiple of 4.
       *
       * In this case, the last group will have fewer than 4 characters, and
       * padding will be inferred.  If the group has one or two characters, it decodes
       * to one byte.  If the group has three characters, it decodes to two bytes.
       *
       * @param input Input to decode.
       * @param webSafe True if we should use the web-safe alphabet.
       * @return bytes representing the decoded value.
       */
      decodeStringToByteArray: function (input, webSafe) {
          this.init_();
          var charToByteMap = webSafe
              ? this.charToByteMapWebSafe_
              : this.charToByteMap_;
          var output = [];
          for (var i = 0; i < input.length;) {
              var byte1 = charToByteMap[input.charAt(i++)];
              var haveByte2 = i < input.length;
              var byte2 = haveByte2 ? charToByteMap[input.charAt(i)] : 0;
              ++i;
              var haveByte3 = i < input.length;
              var byte3 = haveByte3 ? charToByteMap[input.charAt(i)] : 64;
              ++i;
              var haveByte4 = i < input.length;
              var byte4 = haveByte4 ? charToByteMap[input.charAt(i)] : 64;
              ++i;
              if (byte1 == null || byte2 == null || byte3 == null || byte4 == null) {
                  throw Error();
              }
              var outByte1 = (byte1 << 2) | (byte2 >> 4);
              output.push(outByte1);
              if (byte3 !== 64) {
                  var outByte2 = ((byte2 << 4) & 0xf0) | (byte3 >> 2);
                  output.push(outByte2);
                  if (byte4 !== 64) {
                      var outByte3 = ((byte3 << 6) & 0xc0) | byte4;
                      output.push(outByte3);
                  }
              }
          }
          return output;
      },
      /**
       * Lazy static initialization function. Called before
       * accessing any of the static map variables.
       * @private
       */
      init_: function () {
          if (!this.byteToCharMap_) {
              this.byteToCharMap_ = {};
              this.charToByteMap_ = {};
              this.byteToCharMapWebSafe_ = {};
              this.charToByteMapWebSafe_ = {};
              // We want quick mappings back and forth, so we precompute two maps.
              for (var i = 0; i < this.ENCODED_VALS.length; i++) {
                  this.byteToCharMap_[i] = this.ENCODED_VALS.charAt(i);
                  this.charToByteMap_[this.byteToCharMap_[i]] = i;
                  this.byteToCharMapWebSafe_[i] = this.ENCODED_VALS_WEBSAFE.charAt(i);
                  this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[i]] = i;
                  // Be forgiving when decoding and correctly decode both encodings.
                  if (i >= this.ENCODED_VALS_BASE.length) {
                      this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(i)] = i;
                      this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(i)] = i;
                  }
              }
          }
      }
  };
  /**
   * URL-safe base64 encoding
   */
  var base64Encode = function (str) {
      var utf8Bytes = stringToByteArray(str);
      return base64.encodeByteArray(utf8Bytes, true);
  };
  /**
   * URL-safe base64 decoding
   *
   * NOTE: DO NOT use the global atob() function - it does NOT support the
   * base64Url variant encoding.
   *
   * @param str To be decoded
   * @return Decoded result, if possible
   */
  var base64Decode = function (str) {
      try {
          return base64.decodeString(str, true);
      }
      catch (e) {
          console.error('base64Decode failed: ', e);
      }
      return null;
  };

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Do a deep-copy of basic JavaScript Objects or Arrays.
   */
  function deepCopy(value) {
      return deepExtend(undefined, value);
  }
  /**
   * Copy properties from source to target (recursively allows extension
   * of Objects and Arrays).  Scalar values in the target are over-written.
   * If target is undefined, an object of the appropriate type will be created
   * (and returned).
   *
   * We recursively copy all child properties of plain Objects in the source- so
   * that namespace- like dictionaries are merged.
   *
   * Note that the target can be a function, in which case the properties in
   * the source Object are copied onto it as static properties of the Function.
   */
  function deepExtend(target, source) {
      if (!(source instanceof Object)) {
          return source;
      }
      switch (source.constructor) {
          case Date:
              // Treat Dates like scalars; if the target date object had any child
              // properties - they will be lost!
              var dateValue = source;
              return new Date(dateValue.getTime());
          case Object:
              if (target === undefined) {
                  target = {};
              }
              break;
          case Array:
              // Always copy the array source and overwrite the target.
              target = [];
              break;
          default:
              // Not a plain Object - treat it as a scalar.
              return source;
      }
      for (var prop in source) {
          if (!source.hasOwnProperty(prop)) {
              continue;
          }
          target[prop] = deepExtend(target[prop], source[prop]);
      }
      return target;
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var Deferred = /** @class */ (function () {
      function Deferred() {
          var _this = this;
          this.reject = function () { };
          this.resolve = function () { };
          this.promise = new Promise(function (resolve, reject) {
              _this.resolve = resolve;
              _this.reject = reject;
          });
      }
      /**
       * Our API internals are not promiseified and cannot because our callback APIs have subtle expectations around
       * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
       * and returns a node-style callback which will resolve or reject the Deferred's promise.
       */
      Deferred.prototype.wrapCallback = function (callback) {
          var _this = this;
          return function (error, value) {
              if (error) {
                  _this.reject(error);
              }
              else {
                  _this.resolve(value);
              }
              if (typeof callback === 'function') {
                  // Attaching noop handler just in case developer wasn't expecting
                  // promises
                  _this.promise.catch(function () { });
                  // Some of our callbacks don't expect a value and our own tests
                  // assert that the parameter length is 1
                  if (callback.length === 1) {
                      callback(error);
                  }
                  else {
                      callback(error, value);
                  }
              }
          };
      };
      return Deferred;
  }());

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Returns navigator.userAgent string or '' if it's not defined.
   * @return user agent string
   */
  function getUA() {
      if (typeof navigator !== 'undefined' &&
          typeof navigator['userAgent'] === 'string') {
          return navigator['userAgent'];
      }
      else {
          return '';
      }
  }
  /**
   * Detect Cordova / PhoneGap / Ionic frameworks on a mobile device.
   *
   * Deliberately does not rely on checking `file://` URLs (as this fails PhoneGap
   * in the Ripple emulator) nor Cordova `onDeviceReady`, which would normally
   * wait for a callback.
   */
  function isMobileCordova() {
      return (typeof window !== 'undefined' &&
          // @ts-ignore Setting up an broadly applicable index signature for Window
          // just to deal with this case would probably be a bad idea.
          !!(window['cordova'] || window['phonegap'] || window['PhoneGap']) &&
          /ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(getUA()));
  }
  /**
   * Detect Node.js.
   *
   * @return true if Node.js environment is detected.
   */
  // Node detection logic from: https://github.com/iliakan/detect-node/
  function isNode() {
      try {
          return (Object.prototype.toString.call(commonjsGlobal.process) === '[object process]');
      }
      catch (e) {
          return false;
      }
  }
  /**
   * Detect Browser Environment
   */
  function isBrowser() {
      return typeof self === 'object' && self.self === self;
  }
  /**
   * Detect React Native.
   *
   * @return true if ReactNative environment is detected.
   */
  function isReactNative() {
      return (typeof navigator === 'object' && navigator['product'] === 'ReactNative');
  }
  /**
   * Detect whether the current SDK build is the Node version.
   *
   * @return true if it's the Node SDK build.
   */
  function isNodeSdk() {
      return CONSTANTS.NODE_CLIENT === true || CONSTANTS.NODE_ADMIN === true;
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var ERROR_NAME = 'FirebaseError';
  // Based on code from:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types
  var FirebaseError = /** @class */ (function (_super) {
      tslib_es6.__extends(FirebaseError, _super);
      function FirebaseError(code, message) {
          var _this = _super.call(this, message) || this;
          _this.code = code;
          _this.name = ERROR_NAME;
          // Fix For ES5
          // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
          Object.setPrototypeOf(_this, FirebaseError.prototype);
          // Maintains proper stack trace for where our error was thrown.
          // Only available on V8.
          if (Error.captureStackTrace) {
              Error.captureStackTrace(_this, ErrorFactory.prototype.create);
          }
          return _this;
      }
      return FirebaseError;
  }(Error));
  var ErrorFactory = /** @class */ (function () {
      function ErrorFactory(service, serviceName, errors) {
          this.service = service;
          this.serviceName = serviceName;
          this.errors = errors;
      }
      ErrorFactory.prototype.create = function (code) {
          var data = [];
          for (var _i = 1; _i < arguments.length; _i++) {
              data[_i - 1] = arguments[_i];
          }
          var customData = data[0] || {};
          var fullCode = this.service + "/" + code;
          var template = this.errors[code];
          var message = template ? replaceTemplate(template, customData) : 'Error';
          // Service Name: Error message (service/code).
          var fullMessage = this.serviceName + ": " + message + " (" + fullCode + ").";
          var error = new FirebaseError(fullCode, fullMessage);
          // Keys with an underscore at the end of their name are not included in
          // error.data for some reason.
          // TODO: Replace with Object.entries when lib is updated to es2017.
          for (var _a = 0, _b = Object.keys(customData); _a < _b.length; _a++) {
              var key = _b[_a];
              if (key.slice(-1) !== '_') {
                  if (key in error) {
                      console.warn("Overwriting FirebaseError base field \"" + key + "\" can cause unexpected behavior.");
                  }
                  error[key] = customData[key];
              }
          }
          return error;
      };
      return ErrorFactory;
  }());
  function replaceTemplate(template, data) {
      return template.replace(PATTERN, function (_, key) {
          var value = data[key];
          return value != null ? value.toString() : "<" + key + "?>";
      });
  }
  var PATTERN = /\{\$([^}]+)}/g;

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Evaluates a JSON string into a javascript object.
   *
   * @param {string} str A string containing JSON.
   * @return {*} The javascript object representing the specified JSON.
   */
  function jsonEval(str) {
      return JSON.parse(str);
  }
  /**
   * Returns JSON representing a javascript object.
   * @param {*} data Javascript object to be stringified.
   * @return {string} The JSON contents of the object.
   */
  function stringify(data) {
      return JSON.stringify(data);
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Decodes a Firebase auth. token into constituent parts.
   *
   * Notes:
   * - May return with invalid / incomplete claims if there's no native base64 decoding support.
   * - Doesn't check if the token is actually valid.
   */
  var decode = function (token) {
      var header = {}, claims = {}, data = {}, signature = '';
      try {
          var parts = token.split('.');
          header = jsonEval(base64Decode(parts[0]) || '');
          claims = jsonEval(base64Decode(parts[1]) || '');
          signature = parts[2];
          data = claims['d'] || {};
          delete claims['d'];
      }
      catch (e) { }
      return {
          header: header,
          claims: claims,
          data: data,
          signature: signature
      };
  };
  /**
   * Decodes a Firebase auth. token and checks the validity of its time-based claims. Will return true if the
   * token is within the time window authorized by the 'nbf' (not-before) and 'iat' (issued-at) claims.
   *
   * Notes:
   * - May return a false negative if there's no native base64 decoding support.
   * - Doesn't check if the token is actually valid.
   */
  var isValidTimestamp = function (token) {
      var claims = decode(token).claims;
      var now = Math.floor(new Date().getTime() / 1000);
      var validSince = 0, validUntil = 0;
      if (typeof claims === 'object') {
          if (claims.hasOwnProperty('nbf')) {
              validSince = claims['nbf'];
          }
          else if (claims.hasOwnProperty('iat')) {
              validSince = claims['iat'];
          }
          if (claims.hasOwnProperty('exp')) {
              validUntil = claims['exp'];
          }
          else {
              // token will expire after 24h by default
              validUntil = validSince + 86400;
          }
      }
      return (!!now &&
          !!validSince &&
          !!validUntil &&
          now >= validSince &&
          now <= validUntil);
  };
  /**
   * Decodes a Firebase auth. token and returns its issued at time if valid, null otherwise.
   *
   * Notes:
   * - May return null if there's no native base64 decoding support.
   * - Doesn't check if the token is actually valid.
   */
  var issuedAtTime = function (token) {
      var claims = decode(token).claims;
      if (typeof claims === 'object' && claims.hasOwnProperty('iat')) {
          return claims['iat'];
      }
      return null;
  };
  /**
   * Decodes a Firebase auth. token and checks the validity of its format. Expects a valid issued-at time.
   *
   * Notes:
   * - May return a false negative if there's no native base64 decoding support.
   * - Doesn't check if the token is actually valid.
   */
  var isValidFormat = function (token) {
      var decoded = decode(token), claims = decoded.claims;
      return !!claims && typeof claims === 'object' && claims.hasOwnProperty('iat');
  };
  /**
   * Attempts to peer into an auth token and determine if it's an admin auth token by looking at the claims portion.
   *
   * Notes:
   * - May return a false negative if there's no native base64 decoding support.
   * - Doesn't check if the token is actually valid.
   */
  var isAdmin = function (token) {
      var claims = decode(token).claims;
      return typeof claims === 'object' && claims['admin'] === true;
  };

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  function contains(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
  }
  function safeGet(obj, key) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
          return obj[key];
      }
      else {
          return undefined;
      }
  }
  function isEmpty(obj) {
      for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              return false;
          }
      }
      return true;
  }
  function map(obj, fn, contextObj) {
      var res = {};
      for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
              res[key] = fn.call(contextObj, obj[key], key, obj);
          }
      }
      return res;
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Returns a querystring-formatted string (e.g. &arg=val&arg2=val2) from a
   * params object (e.g. {arg: 'val', arg2: 'val2'})
   * Note: You must prepend it with ? when adding it to a URL.
   */
  function querystring(querystringParams) {
      var params = [];
      var _loop_1 = function (key, value) {
          if (Array.isArray(value)) {
              value.forEach(function (arrayVal) {
                  params.push(encodeURIComponent(key) + '=' + encodeURIComponent(arrayVal));
              });
          }
          else {
              params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
          }
      };
      for (var _i = 0, _a = Object.entries(querystringParams); _i < _a.length; _i++) {
          var _b = _a[_i], key = _b[0], value = _b[1];
          _loop_1(key, value);
      }
      return params.length ? '&' + params.join('&') : '';
  }
  /**
   * Decodes a querystring (e.g. ?arg=val&arg2=val2) into a params object
   * (e.g. {arg: 'val', arg2: 'val2'})
   */
  function querystringDecode(querystring) {
      var obj = {};
      var tokens = querystring.replace(/^\?/, '').split('&');
      tokens.forEach(function (token) {
          if (token) {
              var key = token.split('=');
              obj[key[0]] = key[1];
          }
      });
      return obj;
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * @fileoverview SHA-1 cryptographic hash.
   * Variable names follow the notation in FIPS PUB 180-3:
   * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
   *
   * Usage:
   *   var sha1 = new sha1();
   *   sha1.update(bytes);
   *   var hash = sha1.digest();
   *
   * Performance:
   *   Chrome 23:   ~400 Mbit/s
   *   Firefox 16:  ~250 Mbit/s
   *
   */
  /**
   * SHA-1 cryptographic hash constructor.
   *
   * The properties declared here are discussed in the above algorithm document.
   * @constructor
   * @final
   * @struct
   */
  var Sha1 = /** @class */ (function () {
      function Sha1() {
          /**
           * Holds the previous values of accumulated variables a-e in the compress_
           * function.
           * @private
           */
          this.chain_ = [];
          /**
           * A buffer holding the partially computed hash result.
           * @private
           */
          this.buf_ = [];
          /**
           * An array of 80 bytes, each a part of the message to be hashed.  Referred to
           * as the message schedule in the docs.
           * @private
           */
          this.W_ = [];
          /**
           * Contains data needed to pad messages less than 64 bytes.
           * @private
           */
          this.pad_ = [];
          /**
           * @private {number}
           */
          this.inbuf_ = 0;
          /**
           * @private {number}
           */
          this.total_ = 0;
          this.blockSize = 512 / 8;
          this.pad_[0] = 128;
          for (var i = 1; i < this.blockSize; ++i) {
              this.pad_[i] = 0;
          }
          this.reset();
      }
      Sha1.prototype.reset = function () {
          this.chain_[0] = 0x67452301;
          this.chain_[1] = 0xefcdab89;
          this.chain_[2] = 0x98badcfe;
          this.chain_[3] = 0x10325476;
          this.chain_[4] = 0xc3d2e1f0;
          this.inbuf_ = 0;
          this.total_ = 0;
      };
      /**
       * Internal compress helper function.
       * @param buf Block to compress.
       * @param offset Offset of the block in the buffer.
       * @private
       */
      Sha1.prototype.compress_ = function (buf, offset) {
          if (!offset) {
              offset = 0;
          }
          var W = this.W_;
          // get 16 big endian words
          if (typeof buf === 'string') {
              for (var i = 0; i < 16; i++) {
                  // TODO(user): [bug 8140122] Recent versions of Safari for Mac OS and iOS
                  // have a bug that turns the post-increment ++ operator into pre-increment
                  // during JIT compilation.  We have code that depends heavily on SHA-1 for
                  // correctness and which is affected by this bug, so I've removed all uses
                  // of post-increment ++ in which the result value is used.  We can revert
                  // this change once the Safari bug
                  // (https://bugs.webkit.org/show_bug.cgi?id=109036) has been fixed and
                  // most clients have been updated.
                  W[i] =
                      (buf.charCodeAt(offset) << 24) |
                          (buf.charCodeAt(offset + 1) << 16) |
                          (buf.charCodeAt(offset + 2) << 8) |
                          buf.charCodeAt(offset + 3);
                  offset += 4;
              }
          }
          else {
              for (var i = 0; i < 16; i++) {
                  W[i] =
                      (buf[offset] << 24) |
                          (buf[offset + 1] << 16) |
                          (buf[offset + 2] << 8) |
                          buf[offset + 3];
                  offset += 4;
              }
          }
          // expand to 80 words
          for (var i = 16; i < 80; i++) {
              var t = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
              W[i] = ((t << 1) | (t >>> 31)) & 0xffffffff;
          }
          var a = this.chain_[0];
          var b = this.chain_[1];
          var c = this.chain_[2];
          var d = this.chain_[3];
          var e = this.chain_[4];
          var f, k;
          // TODO(user): Try to unroll this loop to speed up the computation.
          for (var i = 0; i < 80; i++) {
              if (i < 40) {
                  if (i < 20) {
                      f = d ^ (b & (c ^ d));
                      k = 0x5a827999;
                  }
                  else {
                      f = b ^ c ^ d;
                      k = 0x6ed9eba1;
                  }
              }
              else {
                  if (i < 60) {
                      f = (b & c) | (d & (b | c));
                      k = 0x8f1bbcdc;
                  }
                  else {
                      f = b ^ c ^ d;
                      k = 0xca62c1d6;
                  }
              }
              var t = (((a << 5) | (a >>> 27)) + f + e + k + W[i]) & 0xffffffff;
              e = d;
              d = c;
              c = ((b << 30) | (b >>> 2)) & 0xffffffff;
              b = a;
              a = t;
          }
          this.chain_[0] = (this.chain_[0] + a) & 0xffffffff;
          this.chain_[1] = (this.chain_[1] + b) & 0xffffffff;
          this.chain_[2] = (this.chain_[2] + c) & 0xffffffff;
          this.chain_[3] = (this.chain_[3] + d) & 0xffffffff;
          this.chain_[4] = (this.chain_[4] + e) & 0xffffffff;
      };
      Sha1.prototype.update = function (bytes, length) {
          // TODO(johnlenz): tighten the function signature and remove this check
          if (bytes == null) {
              return;
          }
          if (length === undefined) {
              length = bytes.length;
          }
          var lengthMinusBlock = length - this.blockSize;
          var n = 0;
          // Using local instead of member variables gives ~5% speedup on Firefox 16.
          var buf = this.buf_;
          var inbuf = this.inbuf_;
          // The outer while loop should execute at most twice.
          while (n < length) {
              // When we have no data in the block to top up, we can directly process the
              // input buffer (assuming it contains sufficient data). This gives ~25%
              // speedup on Chrome 23 and ~15% speedup on Firefox 16, but requires that
              // the data is provided in large chunks (or in multiples of 64 bytes).
              if (inbuf === 0) {
                  while (n <= lengthMinusBlock) {
                      this.compress_(bytes, n);
                      n += this.blockSize;
                  }
              }
              if (typeof bytes === 'string') {
                  while (n < length) {
                      buf[inbuf] = bytes.charCodeAt(n);
                      ++inbuf;
                      ++n;
                      if (inbuf === this.blockSize) {
                          this.compress_(buf);
                          inbuf = 0;
                          // Jump to the outer loop so we use the full-block optimization.
                          break;
                      }
                  }
              }
              else {
                  while (n < length) {
                      buf[inbuf] = bytes[n];
                      ++inbuf;
                      ++n;
                      if (inbuf === this.blockSize) {
                          this.compress_(buf);
                          inbuf = 0;
                          // Jump to the outer loop so we use the full-block optimization.
                          break;
                      }
                  }
              }
          }
          this.inbuf_ = inbuf;
          this.total_ += length;
      };
      /** @override */
      Sha1.prototype.digest = function () {
          var digest = [];
          var totalBits = this.total_ * 8;
          // Add pad 0x80 0x00*.
          if (this.inbuf_ < 56) {
              this.update(this.pad_, 56 - this.inbuf_);
          }
          else {
              this.update(this.pad_, this.blockSize - (this.inbuf_ - 56));
          }
          // Add # bits.
          for (var i = this.blockSize - 1; i >= 56; i--) {
              this.buf_[i] = totalBits & 255;
              totalBits /= 256; // Don't use bit-shifting here!
          }
          this.compress_(this.buf_);
          var n = 0;
          for (var i = 0; i < 5; i++) {
              for (var j = 24; j >= 0; j -= 8) {
                  digest[n] = (this.chain_[i] >> j) & 255;
                  ++n;
              }
          }
          return digest;
      };
      return Sha1;
  }());

  /**
   * Helper to make a Subscribe function (just like Promise helps make a
   * Thenable).
   *
   * @param executor Function which can make calls to a single Observer
   *     as a proxy.
   * @param onNoObservers Callback when count of Observers goes to zero.
   */
  function createSubscribe(executor, onNoObservers) {
      var proxy = new ObserverProxy(executor, onNoObservers);
      return proxy.subscribe.bind(proxy);
  }
  /**
   * Implement fan-out for any number of Observers attached via a subscribe
   * function.
   */
  var ObserverProxy = /** @class */ (function () {
      /**
       * @param executor Function which can make calls to a single Observer
       *     as a proxy.
       * @param onNoObservers Callback when count of Observers goes to zero.
       */
      function ObserverProxy(executor, onNoObservers) {
          var _this = this;
          this.observers = [];
          this.unsubscribes = [];
          this.observerCount = 0;
          // Micro-task scheduling by calling task.then().
          this.task = Promise.resolve();
          this.finalized = false;
          this.onNoObservers = onNoObservers;
          // Call the executor asynchronously so subscribers that are called
          // synchronously after the creation of the subscribe function
          // can still receive the very first value generated in the executor.
          this.task
              .then(function () {
              executor(_this);
          })
              .catch(function (e) {
              _this.error(e);
          });
      }
      ObserverProxy.prototype.next = function (value) {
          this.forEachObserver(function (observer) {
              observer.next(value);
          });
      };
      ObserverProxy.prototype.error = function (error) {
          this.forEachObserver(function (observer) {
              observer.error(error);
          });
          this.close(error);
      };
      ObserverProxy.prototype.complete = function () {
          this.forEachObserver(function (observer) {
              observer.complete();
          });
          this.close();
      };
      /**
       * Subscribe function that can be used to add an Observer to the fan-out list.
       *
       * - We require that no event is sent to a subscriber sychronously to their
       *   call to subscribe().
       */
      ObserverProxy.prototype.subscribe = function (nextOrObserver, error, complete) {
          var _this = this;
          var observer;
          if (nextOrObserver === undefined &&
              error === undefined &&
              complete === undefined) {
              throw new Error('Missing Observer.');
          }
          // Assemble an Observer object when passed as callback functions.
          if (implementsAnyMethods(nextOrObserver, [
              'next',
              'error',
              'complete'
          ])) {
              observer = nextOrObserver;
          }
          else {
              observer = {
                  next: nextOrObserver,
                  error: error,
                  complete: complete
              };
          }
          if (observer.next === undefined) {
              observer.next = noop;
          }
          if (observer.error === undefined) {
              observer.error = noop;
          }
          if (observer.complete === undefined) {
              observer.complete = noop;
          }
          var unsub = this.unsubscribeOne.bind(this, this.observers.length);
          // Attempt to subscribe to a terminated Observable - we
          // just respond to the Observer with the final error or complete
          // event.
          if (this.finalized) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              this.task.then(function () {
                  try {
                      if (_this.finalError) {
                          observer.error(_this.finalError);
                      }
                      else {
                          observer.complete();
                      }
                  }
                  catch (e) {
                      // nothing
                  }
                  return;
              });
          }
          this.observers.push(observer);
          return unsub;
      };
      // Unsubscribe is synchronous - we guarantee that no events are sent to
      // any unsubscribed Observer.
      ObserverProxy.prototype.unsubscribeOne = function (i) {
          if (this.observers === undefined || this.observers[i] === undefined) {
              return;
          }
          delete this.observers[i];
          this.observerCount -= 1;
          if (this.observerCount === 0 && this.onNoObservers !== undefined) {
              this.onNoObservers(this);
          }
      };
      ObserverProxy.prototype.forEachObserver = function (fn) {
          if (this.finalized) {
              // Already closed by previous event....just eat the additional values.
              return;
          }
          // Since sendOne calls asynchronously - there is no chance that
          // this.observers will become undefined.
          for (var i = 0; i < this.observers.length; i++) {
              this.sendOne(i, fn);
          }
      };
      // Call the Observer via one of it's callback function. We are careful to
      // confirm that the observe has not been unsubscribed since this asynchronous
      // function had been queued.
      ObserverProxy.prototype.sendOne = function (i, fn) {
          var _this = this;
          // Execute the callback asynchronously
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.task.then(function () {
              if (_this.observers !== undefined && _this.observers[i] !== undefined) {
                  try {
                      fn(_this.observers[i]);
                  }
                  catch (e) {
                      // Ignore exceptions raised in Observers or missing methods of an
                      // Observer.
                      // Log error to console. b/31404806
                      if (typeof console !== 'undefined' && console.error) {
                          console.error(e);
                      }
                  }
              }
          });
      };
      ObserverProxy.prototype.close = function (err) {
          var _this = this;
          if (this.finalized) {
              return;
          }
          this.finalized = true;
          if (err !== undefined) {
              this.finalError = err;
          }
          // Proxy is no longer needed - garbage collect references
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.task.then(function () {
              _this.observers = undefined;
              _this.onNoObservers = undefined;
          });
      };
      return ObserverProxy;
  }());
  /** Turn synchronous function into one called asynchronously. */
  function async(fn, onError) {
      return function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          Promise.resolve(true)
              .then(function () {
              fn.apply(void 0, args);
          })
              .catch(function (error) {
              if (onError) {
                  onError(error);
              }
          });
      };
  }
  /**
   * Return true if the object passed in implements any of the named methods.
   */
  function implementsAnyMethods(obj, methods) {
      if (typeof obj !== 'object' || obj === null) {
          return false;
      }
      for (var _i = 0, methods_1 = methods; _i < methods_1.length; _i++) {
          var method = methods_1[_i];
          if (method in obj && typeof obj[method] === 'function') {
              return true;
          }
      }
      return false;
  }
  function noop() {
      // do nothing
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Check to make sure the appropriate number of arguments are provided for a public function.
   * Throws an error if it fails.
   *
   * @param fnName The function name
   * @param minCount The minimum number of arguments to allow for the function call
   * @param maxCount The maximum number of argument to allow for the function call
   * @param argCount The actual number of arguments provided.
   */
  var validateArgCount = function (fnName, minCount, maxCount, argCount) {
      var argError;
      if (argCount < minCount) {
          argError = 'at least ' + minCount;
      }
      else if (argCount > maxCount) {
          argError = maxCount === 0 ? 'none' : 'no more than ' + maxCount;
      }
      if (argError) {
          var error = fnName +
              ' failed: Was called with ' +
              argCount +
              (argCount === 1 ? ' argument.' : ' arguments.') +
              ' Expects ' +
              argError +
              '.';
          throw new Error(error);
      }
  };
  /**
   * Generates a string to prefix an error message about failed argument validation
   *
   * @param fnName The function name
   * @param argumentNumber The index of the argument
   * @param optional Whether or not the argument is optional
   * @return The prefix to add to the error thrown for validation.
   */
  function errorPrefix(fnName, argumentNumber, optional) {
      var argName = '';
      switch (argumentNumber) {
          case 1:
              argName = optional ? 'first' : 'First';
              break;
          case 2:
              argName = optional ? 'second' : 'Second';
              break;
          case 3:
              argName = optional ? 'third' : 'Third';
              break;
          case 4:
              argName = optional ? 'fourth' : 'Fourth';
              break;
          default:
              throw new Error('errorPrefix called with argumentNumber > 4.  Need to update it?');
      }
      var error = fnName + ' failed: ';
      error += argName + ' argument ';
      return error;
  }
  /**
   * @param fnName
   * @param argumentNumber
   * @param namespace
   * @param optional
   */
  function validateNamespace(fnName, argumentNumber, namespace, optional) {
      if (optional && !namespace) {
          return;
      }
      if (typeof namespace !== 'string') {
          //TODO: I should do more validation here. We only allow certain chars in namespaces.
          throw new Error(errorPrefix(fnName, argumentNumber, optional) +
              'must be a valid firebase namespace.');
      }
  }
  function validateCallback(fnName, argumentNumber, callback, optional) {
      if (optional && !callback) {
          return;
      }
      if (typeof callback !== 'function') {
          throw new Error(errorPrefix(fnName, argumentNumber, optional) +
              'must be a valid function.');
      }
  }
  function validateContextObject(fnName, argumentNumber, context, optional) {
      if (optional && !context) {
          return;
      }
      if (typeof context !== 'object' || context === null) {
          throw new Error(errorPrefix(fnName, argumentNumber, optional) +
              'must be a valid context object.');
      }
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  // Code originally came from goog.crypt.stringToUtf8ByteArray, but for some reason they
  // automatically replaced '\r\n' with '\n', and they didn't handle surrogate pairs,
  // so it's been modified.
  // Note that not all Unicode characters appear as single characters in JavaScript strings.
  // fromCharCode returns the UTF-16 encoding of a character - so some Unicode characters
  // use 2 characters in Javascript.  All 4-byte UTF-8 characters begin with a first
  // character in the range 0xD800 - 0xDBFF (the first character of a so-called surrogate
  // pair).
  // See http://www.ecma-international.org/ecma-262/5.1/#sec-15.1.3
  /**
   * @param {string} str
   * @return {Array}
   */
  var stringToByteArray$1 = function (str) {
      var out = [];
      var p = 0;
      for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i);
          // Is this the lead surrogate in a surrogate pair?
          if (c >= 0xd800 && c <= 0xdbff) {
              var high = c - 0xd800; // the high 10 bits.
              i++;
              assert(i < str.length, 'Surrogate pair missing trail surrogate.');
              var low = str.charCodeAt(i) - 0xdc00; // the low 10 bits.
              c = 0x10000 + (high << 10) + low;
          }
          if (c < 128) {
              out[p++] = c;
          }
          else if (c < 2048) {
              out[p++] = (c >> 6) | 192;
              out[p++] = (c & 63) | 128;
          }
          else if (c < 65536) {
              out[p++] = (c >> 12) | 224;
              out[p++] = ((c >> 6) & 63) | 128;
              out[p++] = (c & 63) | 128;
          }
          else {
              out[p++] = (c >> 18) | 240;
              out[p++] = ((c >> 12) & 63) | 128;
              out[p++] = ((c >> 6) & 63) | 128;
              out[p++] = (c & 63) | 128;
          }
      }
      return out;
  };
  /**
   * Calculate length without actually converting; useful for doing cheaper validation.
   * @param {string} str
   * @return {number}
   */
  var stringLength = function (str) {
      var p = 0;
      for (var i = 0; i < str.length; i++) {
          var c = str.charCodeAt(i);
          if (c < 128) {
              p++;
          }
          else if (c < 2048) {
              p += 2;
          }
          else if (c >= 0xd800 && c <= 0xdbff) {
              // Lead surrogate of a surrogate pair.  The pair together will take 4 bytes to represent.
              p += 4;
              i++; // skip trail surrogate.
          }
          else {
              p += 3;
          }
      }
      return p;
  };

  exports.CONSTANTS = CONSTANTS;
  exports.Deferred = Deferred;
  exports.ErrorFactory = ErrorFactory;
  exports.FirebaseError = FirebaseError;
  exports.Sha1 = Sha1;
  exports.assert = assert;
  exports.assertionError = assertionError;
  exports.async = async;
  exports.base64 = base64;
  exports.base64Decode = base64Decode;
  exports.base64Encode = base64Encode;
  exports.contains = contains;
  exports.createSubscribe = createSubscribe;
  exports.decode = decode;
  exports.deepCopy = deepCopy;
  exports.deepExtend = deepExtend;
  exports.errorPrefix = errorPrefix;
  exports.getUA = getUA;
  exports.isAdmin = isAdmin;
  exports.isBrowser = isBrowser;
  exports.isEmpty = isEmpty;
  exports.isMobileCordova = isMobileCordova;
  exports.isNode = isNode;
  exports.isNodeSdk = isNodeSdk;
  exports.isReactNative = isReactNative;
  exports.isValidFormat = isValidFormat;
  exports.isValidTimestamp = isValidTimestamp;
  exports.issuedAtTime = issuedAtTime;
  exports.jsonEval = jsonEval;
  exports.map = map;
  exports.querystring = querystring;
  exports.querystringDecode = querystringDecode;
  exports.safeGet = safeGet;
  exports.stringLength = stringLength;
  exports.stringToByteArray = stringToByteArray$1;
  exports.stringify = stringify;
  exports.validateArgCount = validateArgCount;
  exports.validateCallback = validateCallback;
  exports.validateContextObject = validateContextObject;
  exports.validateNamespace = validateNamespace;
  //# sourceMappingURL=index.cjs.js.map
  });

  unwrapExports(index_cjs);
  var index_cjs_1 = index_cjs.CONSTANTS;
  var index_cjs_2 = index_cjs.Deferred;
  var index_cjs_3 = index_cjs.ErrorFactory;
  var index_cjs_4 = index_cjs.FirebaseError;
  var index_cjs_5 = index_cjs.Sha1;
  var index_cjs_6 = index_cjs.assert;
  var index_cjs_7 = index_cjs.assertionError;
  var index_cjs_8 = index_cjs.async;
  var index_cjs_9 = index_cjs.base64;
  var index_cjs_10 = index_cjs.base64Decode;
  var index_cjs_11 = index_cjs.base64Encode;
  var index_cjs_12 = index_cjs.contains;
  var index_cjs_13 = index_cjs.createSubscribe;
  var index_cjs_14 = index_cjs.decode;
  var index_cjs_15 = index_cjs.deepCopy;
  var index_cjs_16 = index_cjs.deepExtend;
  var index_cjs_17 = index_cjs.errorPrefix;
  var index_cjs_18 = index_cjs.getUA;
  var index_cjs_19 = index_cjs.isAdmin;
  var index_cjs_20 = index_cjs.isBrowser;
  var index_cjs_21 = index_cjs.isEmpty;
  var index_cjs_22 = index_cjs.isMobileCordova;
  var index_cjs_23 = index_cjs.isNode;
  var index_cjs_24 = index_cjs.isNodeSdk;
  var index_cjs_25 = index_cjs.isReactNative;
  var index_cjs_26 = index_cjs.isValidFormat;
  var index_cjs_27 = index_cjs.isValidTimestamp;
  var index_cjs_28 = index_cjs.issuedAtTime;
  var index_cjs_29 = index_cjs.jsonEval;
  var index_cjs_30 = index_cjs.map;
  var index_cjs_31 = index_cjs.querystring;
  var index_cjs_32 = index_cjs.querystringDecode;
  var index_cjs_33 = index_cjs.safeGet;
  var index_cjs_34 = index_cjs.stringLength;
  var index_cjs_35 = index_cjs.stringToByteArray;
  var index_cjs_36 = index_cjs.stringify;
  var index_cjs_37 = index_cjs.validateArgCount;
  var index_cjs_38 = index_cjs.validateCallback;
  var index_cjs_39 = index_cjs.validateContextObject;
  var index_cjs_40 = index_cjs.validateNamespace;

  var index_cjs$1 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, '__esModule', { value: true });




  /**
   * Component for service name T, e.g. `auth`, `auth-internal`
   */
  var Component = /** @class */ (function () {
      /**
       *
       * @param name The public service name, e.g. app, auth, firestore, database
       * @param instanceFactory Service factory responsible for creating the public interface
       * @param type whehter the service provided by the component is public or private
       */
      function Component(name, instanceFactory, type) {
          this.name = name;
          this.instanceFactory = instanceFactory;
          this.type = type;
          this.multipleInstances = false;
          /**
           * Properties to be added to the service namespace
           */
          this.serviceProps = {};
          this.instantiationMode = "LAZY" /* LAZY */;
      }
      Component.prototype.setInstantiationMode = function (mode) {
          this.instantiationMode = mode;
          return this;
      };
      Component.prototype.setMultipleInstances = function (multipleInstances) {
          this.multipleInstances = multipleInstances;
          return this;
      };
      Component.prototype.setServiceProps = function (props) {
          this.serviceProps = props;
          return this;
      };
      return Component;
  }());

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var DEFAULT_ENTRY_NAME = '[DEFAULT]';

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Provider for instance for service name T, e.g. 'auth', 'auth-internal'
   * NameServiceMapping[T] is an alias for the type of the instance
   */
  var Provider = /** @class */ (function () {
      function Provider(name, container) {
          this.name = name;
          this.container = container;
          this.component = null;
          this.instances = new Map();
          this.instancesDeferred = new Map();
      }
      /**
       * @param identifier A provider can provide mulitple instances of a service
       * if this.component.multipleInstances is true.
       */
      Provider.prototype.get = function (identifier) {
          if (identifier === void 0) { identifier = DEFAULT_ENTRY_NAME; }
          // if multipleInstances is not supported, use the default name
          var normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
          if (!this.instancesDeferred.has(normalizedIdentifier)) {
              var deferred = new index_cjs.Deferred();
              this.instancesDeferred.set(normalizedIdentifier, deferred);
              // If the service instance is available, resolve the promise with it immediately
              try {
                  var instance = this.getOrInitializeService(normalizedIdentifier);
                  if (instance) {
                      deferred.resolve(instance);
                  }
              }
              catch (e) {
                  // when the instance factory throws an exception during get(), it should not cause
                  // a fatal error. We just return the unresolved promise in this case.
              }
          }
          return this.instancesDeferred.get(normalizedIdentifier).promise;
      };
      Provider.prototype.getImmediate = function (options) {
          var _a = tslib_es6.__assign({ identifier: DEFAULT_ENTRY_NAME, optional: false }, options), identifier = _a.identifier, optional = _a.optional;
          // if multipleInstances is not supported, use the default name
          var normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
          try {
              var instance = this.getOrInitializeService(normalizedIdentifier);
              if (!instance) {
                  if (optional) {
                      return null;
                  }
                  throw Error("Service " + this.name + " is not available");
              }
              return instance;
          }
          catch (e) {
              if (optional) {
                  return null;
              }
              else {
                  throw e;
              }
          }
      };
      Provider.prototype.getComponent = function () {
          return this.component;
      };
      Provider.prototype.setComponent = function (component) {
          var e_1, _a;
          if (component.name !== this.name) {
              throw Error("Mismatching Component " + component.name + " for Provider " + this.name + ".");
          }
          if (this.component) {
              throw Error("Component for " + this.name + " has already been provided");
          }
          this.component = component;
          // if the service is eager, initialize the default instance
          if (isComponentEager(component)) {
              try {
                  this.getOrInitializeService(DEFAULT_ENTRY_NAME);
              }
              catch (e) {
                  // when the instance factory for an eager Component throws an exception during the eager
                  // initialization, it should not cause a fatal error.
                  // TODO: Investigate if we need to make it configurable, because some component may want to cause
                  // a fatal error in this case?
              }
          }
          try {
              // Create service instances for the pending promises and resolve them
              // NOTE: if this.multipleInstances is false, only the default instance will be created
              // and all promises with resolve with it regardless of the identifier.
              for (var _b = tslib_es6.__values(this.instancesDeferred.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                  var _d = tslib_es6.__read(_c.value, 2), instanceIdentifier = _d[0], instanceDeferred = _d[1];
                  var normalizedIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
                  try {
                      // `getOrInitializeService()` should always return a valid instance since a component is guaranteed. use ! to make typescript happy.
                      var instance = this.getOrInitializeService(normalizedIdentifier);
                      instanceDeferred.resolve(instance);
                  }
                  catch (e) {
                      // when the instance factory throws an exception, it should not cause
                      // a fatal error. We just leave the promise unresolved.
                  }
              }
          }
          catch (e_1_1) { e_1 = { error: e_1_1 }; }
          finally {
              try {
                  if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
              }
              finally { if (e_1) throw e_1.error; }
          }
      };
      Provider.prototype.clearInstance = function (identifier) {
          if (identifier === void 0) { identifier = DEFAULT_ENTRY_NAME; }
          this.instancesDeferred.delete(identifier);
          this.instances.delete(identifier);
      };
      // app.delete() will call this method on every provider to delete the services
      // TODO: should we mark the provider as deleted?
      Provider.prototype.delete = function () {
          return tslib_es6.__awaiter(this, void 0, void 0, function () {
              var services;
              return tslib_es6.__generator(this, function (_a) {
                  switch (_a.label) {
                      case 0:
                          services = Array.from(this.instances.values());
                          return [4 /*yield*/, Promise.all(services
                                  .filter(function (service) { return 'INTERNAL' in service; })
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  .map(function (service) { return service.INTERNAL.delete(); }))];
                      case 1:
                          _a.sent();
                          return [2 /*return*/];
                  }
              });
          });
      };
      Provider.prototype.isComponentSet = function () {
          return this.component != null;
      };
      Provider.prototype.getOrInitializeService = function (identifier) {
          var instance = this.instances.get(identifier);
          if (!instance && this.component) {
              instance = this.component.instanceFactory(this.container, normalizeIdentifierForFactory(identifier));
              this.instances.set(identifier, instance);
          }
          return instance || null;
      };
      Provider.prototype.normalizeInstanceIdentifier = function (identifier) {
          if (this.component) {
              return this.component.multipleInstances ? identifier : DEFAULT_ENTRY_NAME;
          }
          else {
              return identifier; // assume multiple instances are supported before the component is provided.
          }
      };
      return Provider;
  }());
  // undefined should be passed to the service factory for the default instance
  function normalizeIdentifierForFactory(identifier) {
      return identifier === DEFAULT_ENTRY_NAME ? undefined : identifier;
  }
  function isComponentEager(component) {
      return component.instantiationMode === "EAGER" /* EAGER */;
  }

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * ComponentContainer that provides Providers for service name T, e.g. `auth`, `auth-internal`
   */
  var ComponentContainer = /** @class */ (function () {
      function ComponentContainer(name) {
          this.name = name;
          this.providers = new Map();
      }
      /**
       *
       * @param component Component being added
       * @param overwrite When a component with the same name has already been registered,
       * if overwrite is true: overwrite the existing component with the new component and create a new
       * provider with the new component. It can be useful in tests where you want to use different mocks
       * for different tests.
       * if overwrite is false: throw an exception
       */
      ComponentContainer.prototype.addComponent = function (component) {
          var provider = this.getProvider(component.name);
          if (provider.isComponentSet()) {
              throw new Error("Component " + component.name + " has already been registered with " + this.name);
          }
          provider.setComponent(component);
      };
      ComponentContainer.prototype.addOrOverwriteComponent = function (component) {
          var provider = this.getProvider(component.name);
          if (provider.isComponentSet()) {
              // delete the existing provider from the container, so we can register the new component
              this.providers.delete(component.name);
          }
          this.addComponent(component);
      };
      /**
       * getProvider provides a type safe interface where it can only be called with a field name
       * present in NameServiceMapping interface.
       *
       * Firebase SDKs providing services should extend NameServiceMapping interface to register
       * themselves.
       */
      ComponentContainer.prototype.getProvider = function (name) {
          if (this.providers.has(name)) {
              return this.providers.get(name);
          }
          // create a Provider for a service that hasn't registered with Firebase
          var provider = new Provider(name, this);
          this.providers.set(name, provider);
          return provider;
      };
      ComponentContainer.prototype.getProviders = function () {
          return Array.from(this.providers.values());
      };
      return ComponentContainer;
  }());

  exports.Component = Component;
  exports.ComponentContainer = ComponentContainer;
  exports.Provider = Provider;
  //# sourceMappingURL=index.cjs.js.map
  });

  unwrapExports(index_cjs$1);
  var index_cjs_1$1 = index_cjs$1.Component;
  var index_cjs_2$1 = index_cjs$1.ComponentContainer;
  var index_cjs_3$1 = index_cjs$1.Provider;

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */

  function __spreadArrays$1() {
      for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
      for (var r = Array(s), k = 0, i = 0; i < il; i++)
          for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
              r[k] = a[j];
      return r;
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * A container for all of the Logger instances
   */
  var instances = [];
  /**
   * The JS SDK supports 5 log levels and also allows a user the ability to
   * silence the logs altogether.
   *
   * The order is a follows:
   * DEBUG < VERBOSE < INFO < WARN < ERROR
   *
   * All of the log types above the current log level will be captured (i.e. if
   * you set the log level to `INFO`, errors will still be logged, but `DEBUG` and
   * `VERBOSE` logs will not)
   */
  var LogLevel;
  (function (LogLevel) {
      LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
      LogLevel[LogLevel["VERBOSE"] = 1] = "VERBOSE";
      LogLevel[LogLevel["INFO"] = 2] = "INFO";
      LogLevel[LogLevel["WARN"] = 3] = "WARN";
      LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
      LogLevel[LogLevel["SILENT"] = 5] = "SILENT";
  })(LogLevel || (LogLevel = {}));
  /**
   * The default log level
   */
  var defaultLogLevel = LogLevel.INFO;
  /**
   * The default log handler will forward DEBUG, VERBOSE, INFO, WARN, and ERROR
   * messages on to their corresponding console counterparts (if the log method
   * is supported by the current log level)
   */
  var defaultLogHandler = function (instance, logType) {
      var args = [];
      for (var _i = 2; _i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
      }
      if (logType < instance.logLevel) {
          return;
      }
      var now = new Date().toISOString();
      switch (logType) {
          /**
           * By default, `console.debug` is not displayed in the developer console (in
           * chrome). To avoid forcing users to have to opt-in to these logs twice
           * (i.e. once for firebase, and once in the console), we are sending `DEBUG`
           * logs to the `console.log` function.
           */
          case LogLevel.DEBUG:
              console.log.apply(console, __spreadArrays$1(["[" + now + "]  " + instance.name + ":"], args));
              break;
          case LogLevel.VERBOSE:
              console.log.apply(console, __spreadArrays$1(["[" + now + "]  " + instance.name + ":"], args));
              break;
          case LogLevel.INFO:
              console.info.apply(console, __spreadArrays$1(["[" + now + "]  " + instance.name + ":"], args));
              break;
          case LogLevel.WARN:
              console.warn.apply(console, __spreadArrays$1(["[" + now + "]  " + instance.name + ":"], args));
              break;
          case LogLevel.ERROR:
              console.error.apply(console, __spreadArrays$1(["[" + now + "]  " + instance.name + ":"], args));
              break;
          default:
              throw new Error("Attempted to log a message with an invalid logType (value: " + logType + ")");
      }
  };
  var Logger = /** @class */ (function () {
      /**
       * Gives you an instance of a Logger to capture messages according to
       * Firebase's logging scheme.
       *
       * @param name The name that the logs will be associated with
       */
      function Logger(name) {
          this.name = name;
          /**
           * The log level of the given Logger instance.
           */
          this._logLevel = defaultLogLevel;
          /**
           * The log handler for the Logger instance.
           */
          this._logHandler = defaultLogHandler;
          /**
           * Capture the current instance for later use
           */
          instances.push(this);
      }
      Object.defineProperty(Logger.prototype, "logLevel", {
          get: function () {
              return this._logLevel;
          },
          set: function (val) {
              if (!(val in LogLevel)) {
                  throw new TypeError('Invalid value assigned to `logLevel`');
              }
              this._logLevel = val;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(Logger.prototype, "logHandler", {
          get: function () {
              return this._logHandler;
          },
          set: function (val) {
              if (typeof val !== 'function') {
                  throw new TypeError('Value assigned to `logHandler` must be a function');
              }
              this._logHandler = val;
          },
          enumerable: true,
          configurable: true
      });
      /**
       * The functions below are all based on the `console` interface
       */
      Logger.prototype.debug = function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          this._logHandler.apply(this, __spreadArrays$1([this, LogLevel.DEBUG], args));
      };
      Logger.prototype.log = function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          this._logHandler.apply(this, __spreadArrays$1([this, LogLevel.VERBOSE], args));
      };
      Logger.prototype.info = function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          this._logHandler.apply(this, __spreadArrays$1([this, LogLevel.INFO], args));
      };
      Logger.prototype.warn = function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          this._logHandler.apply(this, __spreadArrays$1([this, LogLevel.WARN], args));
      };
      Logger.prototype.error = function () {
          var args = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              args[_i] = arguments[_i];
          }
          this._logHandler.apply(this, __spreadArrays$1([this, LogLevel.ERROR], args));
      };
      return Logger;
  }());

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  function setLogLevel(level) {
      instances.forEach(function (inst) {
          inst.logLevel = level;
      });
  }
  //# sourceMappingURL=index.esm.js.map

  var index_esm = /*#__PURE__*/Object.freeze({
    __proto__: null,
    get LogLevel () { return LogLevel; },
    Logger: Logger,
    setLogLevel: setLogLevel
  });

  var index_cjs$2 = createCommonjsModule(function (module, exports) {

  Object.defineProperty(exports, '__esModule', { value: true });






  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var _a;
  var ERRORS = (_a = {},
      _a["no-app" /* NO_APP */] = "No Firebase App '{$appName}' has been created - " +
          'call Firebase App.initializeApp()',
      _a["bad-app-name" /* BAD_APP_NAME */] = "Illegal App name: '{$appName}",
      _a["duplicate-app" /* DUPLICATE_APP */] = "Firebase App named '{$appName}' already exists",
      _a["app-deleted" /* APP_DELETED */] = "Firebase App named '{$appName}' already deleted",
      _a["invalid-app-argument" /* INVALID_APP_ARGUMENT */] = 'firebase.{$appName}() takes either no argument or a ' +
          'Firebase App instance.',
      _a);
  var ERROR_FACTORY = new index_cjs.ErrorFactory('app', 'Firebase', ERRORS);

  var name = "@firebase/app";
  var version = "0.5.0";

  var name$1 = "@firebase/analytics";

  var name$2 = "@firebase/auth";

  var name$3 = "@firebase/database";

  var name$4 = "@firebase/functions";

  var name$5 = "@firebase/installations";

  var name$6 = "@firebase/messaging";

  var name$7 = "@firebase/performance";

  var name$8 = "@firebase/remote-config";

  var name$9 = "@firebase/storage";

  var name$a = "@firebase/firestore";

  var name$b = "firebase-wrapper";

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var _a$1;
  var DEFAULT_ENTRY_NAME = '[DEFAULT]';
  var PLATFORM_LOG_STRING = (_a$1 = {},
      _a$1[name] = 'fire-core',
      _a$1[name$1] = 'fire-analytics',
      _a$1[name$2] = 'fire-auth',
      _a$1[name$3] = 'fire-rtdb',
      _a$1[name$4] = 'fire-fn',
      _a$1[name$5] = 'fire-iid',
      _a$1[name$6] = 'fire-fcm',
      _a$1[name$7] = 'fire-perf',
      _a$1[name$8] = 'fire-rc',
      _a$1[name$9] = 'fire-gcs',
      _a$1[name$a] = 'fire-fst',
      _a$1['fire-js'] = 'fire-js',
      _a$1[name$b] = 'fire-js-all',
      _a$1);

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var logger = new index_esm.Logger('@firebase/app');

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Global context object for a collection of services using
   * a shared authentication state.
   */
  var FirebaseAppImpl = /** @class */ (function () {
      function FirebaseAppImpl(options, config, firebase_) {
          var e_1, _a;
          var _this = this;
          this.firebase_ = firebase_;
          this.isDeleted_ = false;
          this.name_ = config.name;
          this.automaticDataCollectionEnabled_ =
              config.automaticDataCollectionEnabled || false;
          this.options_ = index_cjs.deepCopy(options);
          this.container = new index_cjs$1.ComponentContainer(config.name);
          // add itself to container
          this._addComponent(new index_cjs$1.Component('app', function () { return _this; }, "PUBLIC" /* PUBLIC */));
          try {
              // populate ComponentContainer with existing components
              for (var _b = tslib_es6.__values(this.firebase_.INTERNAL.components.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                  var component$1 = _c.value;
                  this._addComponent(component$1);
              }
          }
          catch (e_1_1) { e_1 = { error: e_1_1 }; }
          finally {
              try {
                  if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
              }
              finally { if (e_1) throw e_1.error; }
          }
      }
      Object.defineProperty(FirebaseAppImpl.prototype, "automaticDataCollectionEnabled", {
          get: function () {
              this.checkDestroyed_();
              return this.automaticDataCollectionEnabled_;
          },
          set: function (val) {
              this.checkDestroyed_();
              this.automaticDataCollectionEnabled_ = val;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(FirebaseAppImpl.prototype, "name", {
          get: function () {
              this.checkDestroyed_();
              return this.name_;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(FirebaseAppImpl.prototype, "options", {
          get: function () {
              this.checkDestroyed_();
              return this.options_;
          },
          enumerable: true,
          configurable: true
      });
      FirebaseAppImpl.prototype.delete = function () {
          var _this = this;
          return new Promise(function (resolve) {
              _this.checkDestroyed_();
              resolve();
          })
              .then(function () {
              _this.firebase_.INTERNAL.removeApp(_this.name_);
              return Promise.all(_this.container.getProviders().map(function (provider) { return provider.delete(); }));
          })
              .then(function () {
              _this.isDeleted_ = true;
          });
      };
      /**
       * Return a service instance associated with this app (creating it
       * on demand), identified by the passed instanceIdentifier.
       *
       * NOTE: Currently storage and functions are the only ones that are leveraging this
       * functionality. They invoke it by calling:
       *
       * ```javascript
       * firebase.app().storage('STORAGE BUCKET ID')
       * ```
       *
       * The service name is passed to this already
       * @internal
       */
      FirebaseAppImpl.prototype._getService = function (name, instanceIdentifier) {
          if (instanceIdentifier === void 0) { instanceIdentifier = DEFAULT_ENTRY_NAME; }
          this.checkDestroyed_();
          // getImmediate will always succeed because _getService is only called for registered components.
          return this.container.getProvider(name).getImmediate({
              identifier: instanceIdentifier
          });
      };
      /**
       * Remove a service instance from the cache, so we will create a new instance for this service
       * when people try to get this service again.
       *
       * NOTE: currently only firestore is using this functionality to support firestore shutdown.
       *
       * @param name The service name
       * @param instanceIdentifier instance identifier in case multiple instances are allowed
       * @internal
       */
      FirebaseAppImpl.prototype._removeServiceInstance = function (name, instanceIdentifier) {
          if (instanceIdentifier === void 0) { instanceIdentifier = DEFAULT_ENTRY_NAME; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.container.getProvider(name).clearInstance(instanceIdentifier);
      };
      /**
       * @param component the component being added to this app's container
       */
      FirebaseAppImpl.prototype._addComponent = function (component) {
          try {
              this.container.addComponent(component);
          }
          catch (e) {
              logger.debug("Component " + component.name + " failed to register with FirebaseApp " + this.name, e);
          }
      };
      FirebaseAppImpl.prototype._addOrOverwriteComponent = function (component) {
          this.container.addOrOverwriteComponent(component);
      };
      /**
       * This function will throw an Error if the App has already been deleted -
       * use before performing API actions on the App.
       */
      FirebaseAppImpl.prototype.checkDestroyed_ = function () {
          if (this.isDeleted_) {
              throw ERROR_FACTORY.create("app-deleted" /* APP_DELETED */, { appName: this.name_ });
          }
      };
      return FirebaseAppImpl;
  }());
  // Prevent dead-code elimination of these methods w/o invalid property
  // copying.
  (FirebaseAppImpl.prototype.name && FirebaseAppImpl.prototype.options) ||
      FirebaseAppImpl.prototype.delete ||
      console.log('dc');

  var version$1 = "7.6.0";

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Because auth can't share code with other components, we attach the utility functions
   * in an internal namespace to share code.
   * This function return a firebase namespace object without
   * any utility functions, so it can be shared between the regular firebaseNamespace and
   * the lite version.
   */
  function createFirebaseNamespaceCore(firebaseAppImpl) {
      var apps = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      var components = new Map();
      // A namespace is a plain JavaScript Object.
      var namespace = {
          // Hack to prevent Babel from modifying the object returned
          // as the firebase namespace.
          // @ts-ignore
          __esModule: true,
          initializeApp: initializeApp,
          // @ts-ignore
          app: app,
          registerVersion: registerVersion,
          // @ts-ignore
          apps: null,
          SDK_VERSION: version$1,
          INTERNAL: {
              registerComponent: registerComponent,
              removeApp: removeApp,
              components: components,
              useAsService: useAsService
          }
      };
      // Inject a circular default export to allow Babel users who were previously
      // using:
      //
      //   import firebase from 'firebase';
      //   which becomes: var firebase = require('firebase').default;
      //
      // instead of
      //
      //   import * as firebase from 'firebase';
      //   which becomes: var firebase = require('firebase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      namespace['default'] = namespace;
      // firebase.apps is a read-only getter.
      Object.defineProperty(namespace, 'apps', {
          get: getApps
      });
      /**
       * Called by App.delete() - but before any services associated with the App
       * are deleted.
       */
      function removeApp(name) {
          delete apps[name];
      }
      /**
       * Get the App object for a given name (or DEFAULT).
       */
      function app(name) {
          name = name || DEFAULT_ENTRY_NAME;
          if (!index_cjs.contains(apps, name)) {
              throw ERROR_FACTORY.create("no-app" /* NO_APP */, { appName: name });
          }
          return apps[name];
      }
      // @ts-ignore
      app['App'] = firebaseAppImpl;
      function initializeApp(options, rawConfig) {
          if (rawConfig === void 0) { rawConfig = {}; }
          if (typeof rawConfig !== 'object' || rawConfig === null) {
              var name_1 = rawConfig;
              rawConfig = { name: name_1 };
          }
          var config = rawConfig;
          if (config.name === undefined) {
              config.name = DEFAULT_ENTRY_NAME;
          }
          var name = config.name;
          if (typeof name !== 'string' || !name) {
              throw ERROR_FACTORY.create("bad-app-name" /* BAD_APP_NAME */, {
                  appName: String(name)
              });
          }
          if (index_cjs.contains(apps, name)) {
              throw ERROR_FACTORY.create("duplicate-app" /* DUPLICATE_APP */, { appName: name });
          }
          var app = new firebaseAppImpl(options, config, namespace);
          apps[name] = app;
          return app;
      }
      /*
       * Return an array of all the non-deleted FirebaseApps.
       */
      function getApps() {
          // Make a copy so caller cannot mutate the apps list.
          return Object.keys(apps).map(function (name) { return apps[name]; });
      }
      function registerComponent(component) {
          var e_1, _a;
          var componentName = component.name;
          if (components.has(componentName)) {
              logger.debug("There were multiple attempts to register component " + componentName + ".");
              return component.type === "PUBLIC" /* PUBLIC */
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      namespace[componentName]
                  : null;
          }
          components.set(componentName, component);
          // create service namespace for public components
          if (component.type === "PUBLIC" /* PUBLIC */) {
              // The Service namespace is an accessor function ...
              var serviceNamespace = function (appArg) {
                  if (appArg === void 0) { appArg = app(); }
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if (typeof appArg[componentName] !== 'function') {
                      // Invalid argument.
                      // This happens in the following case: firebase.storage('gs:/')
                      throw ERROR_FACTORY.create("invalid-app-argument" /* INVALID_APP_ARGUMENT */, {
                          appName: componentName
                      });
                  }
                  // Forward service instance lookup to the FirebaseApp.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return appArg[componentName]();
              };
              // ... and a container for service-level properties.
              if (component.serviceProps !== undefined) {
                  index_cjs.deepExtend(serviceNamespace, component.serviceProps);
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              namespace[componentName] = serviceNamespace;
              // Patch the FirebaseAppImpl prototype
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              firebaseAppImpl.prototype[componentName] =
                  // TODO: The eslint disable can be removed and the 'ignoreRestArgs'
                  // option added to the no-explicit-any rule when ESlint releases it.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  function () {
                      var args = [];
                      for (var _i = 0; _i < arguments.length; _i++) {
                          args[_i] = arguments[_i];
                      }
                      var serviceFxn = this._getService.bind(this, componentName);
                      return serviceFxn.apply(this, component.multipleInstances ? args : []);
                  };
          }
          try {
              // add the component to existing app instances
              for (var _b = tslib_es6.__values(Object.keys(apps)), _c = _b.next(); !_c.done; _c = _b.next()) {
                  var appName = _c.value;
                  apps[appName]._addComponent(component);
              }
          }
          catch (e_1_1) { e_1 = { error: e_1_1 }; }
          finally {
              try {
                  if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
              }
              finally { if (e_1) throw e_1.error; }
          }
          return component.type === "PUBLIC" /* PUBLIC */
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  namespace[componentName]
              : null;
      }
      function registerVersion(libraryKeyOrName, version, variant) {
          var _a;
          // TODO: We can use this check to whitelist strings when/if we set up
          // a good whitelist system.
          var library = (_a = PLATFORM_LOG_STRING[libraryKeyOrName], (_a !== null && _a !== void 0 ? _a : libraryKeyOrName));
          if (variant) {
              library += "-" + variant;
          }
          var libraryMismatch = library.match(/\s|\//);
          var versionMismatch = version.match(/\s|\//);
          if (libraryMismatch || versionMismatch) {
              var warning = [
                  "Unable to register library \"" + library + "\" with version \"" + version + "\":"
              ];
              if (libraryMismatch) {
                  warning.push("library name \"" + library + "\" contains illegal characters (whitespace or \"/\")");
              }
              if (libraryMismatch && versionMismatch) {
                  warning.push('and');
              }
              if (versionMismatch) {
                  warning.push("version name \"" + version + "\" contains illegal characters (whitespace or \"/\")");
              }
              logger.warn(warning.join(' '));
              return;
          }
          registerComponent(new index_cjs$1.Component(library + "-version", function () { return ({ library: library, version: version }); }, "VERSION" /* VERSION */));
      }
      // Map the requested service to a registered service name
      // (used to map auth to serverAuth service when needed).
      function useAsService(app, name) {
          if (name === 'serverAuth') {
              return null;
          }
          var useService = name;
          return useService;
      }
      return namespace;
  }

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Return a firebase namespace object.
   *
   * In production, this will be called exactly once and the result
   * assigned to the 'firebase' global.  It may be called multiple times
   * in unit tests.
   */
  function createFirebaseNamespace() {
      var namespace = createFirebaseNamespaceCore(FirebaseAppImpl);
      namespace.INTERNAL = tslib_es6.__assign(tslib_es6.__assign({}, namespace.INTERNAL), { createFirebaseNamespace: createFirebaseNamespace,
          extendNamespace: extendNamespace,
          createSubscribe: index_cjs.createSubscribe,
          ErrorFactory: index_cjs.ErrorFactory,
          deepExtend: index_cjs.deepExtend });
      /**
       * Patch the top-level firebase namespace with additional properties.
       *
       * firebase.INTERNAL.extendNamespace()
       */
      function extendNamespace(props) {
          index_cjs.deepExtend(namespace, props);
      }
      return namespace;
  }
  var firebase = createFirebaseNamespace();

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  var PlatformLoggerService = /** @class */ (function () {
      function PlatformLoggerService(container) {
          this.container = container;
      }
      // In initial implementation, this will be called by installations on
      // auth token refresh, and installations will send this string.
      PlatformLoggerService.prototype.getPlatformInfoString = function () {
          var providers = this.container.getProviders();
          // Loop through providers and get library/version pairs from any that are
          // version components.
          return providers
              .map(function (provider) {
              if (isVersionServiceProvider(provider)) {
                  var service = provider.getImmediate();
                  return service.library + "/" + service.version;
              }
              else {
                  return null;
              }
          })
              .filter(function (logString) { return logString; })
              .join(' ');
      };
      return PlatformLoggerService;
  }());
  /**
   *
   * @param provider check if this provider provides a VersionService
   *
   * NOTE: Using Provider<'app-version'> is a hack to indicate that the provider
   * provides VersionService. The provider is not necessarily a 'app-version'
   * provider.
   */
  function isVersionServiceProvider(provider) {
      var _a;
      var component = provider.getComponent();
      return ((_a = component) === null || _a === void 0 ? void 0 : _a.type) === "VERSION" /* VERSION */;
  }

  /**
   * @license
   * Copyright 2019 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  function registerCoreComponents(firebase, variant) {
      firebase.INTERNAL.registerComponent(new index_cjs$1.Component('platform-logger', function (container) { return new PlatformLoggerService(container); }, "PRIVATE" /* PRIVATE */));
      // Register `app` package.
      firebase.registerVersion(name, version, variant);
      // Register platform SDK identifier (no version).
      firebase.registerVersion('fire-js', '');
  }

  /**
   * @license
   * Copyright 2017 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  // Firebase Lite detection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (index_cjs.isBrowser() && self.firebase !== undefined) {
      logger.warn("\n    Warning: Firebase is already defined in the global scope. Please make sure\n    Firebase library is only loaded once.\n  ");
      // eslint-disable-next-line
      var sdkVersion = self.firebase.SDK_VERSION;
      if (sdkVersion && sdkVersion.indexOf('LITE') >= 0) {
          logger.warn("\n    Warning: You are trying to load Firebase while using Firebase Performance standalone script.\n    You should load Firebase Performance with this instance of Firebase to avoid loading duplicate code.\n    ");
      }
  }
  var initializeApp = firebase.initializeApp;
  // TODO: This disable can be removed and the 'ignoreRestArgs' option added to
  // the no-explicit-any rule when ESlint releases it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  firebase.initializeApp = function () {
      var args = [];
      for (var _i = 0; _i < arguments.length; _i++) {
          args[_i] = arguments[_i];
      }
      // Environment check before initializing app
      // Do the check in initializeApp, so people have a chance to disable it by setting logLevel
      // in @firebase/logger
      if (index_cjs.isNode()) {
          logger.warn("\n      Warning: This is a browser-targeted Firebase bundle but it appears it is being\n      run in a Node environment.  If running in a Node environment, make sure you\n      are using the bundle specified by the \"main\" field in package.json.\n      \n      If you are using Webpack, you can specify \"main\" as the first item in\n      \"resolve.mainFields\":\n      https://webpack.js.org/configuration/resolve/#resolvemainfields\n      \n      If using Rollup, use the rollup-plugin-node-resolve plugin and specify \"main\"\n      as the first item in \"mainFields\", e.g. ['main', 'module'].\n      https://github.com/rollup/rollup-plugin-node-resolve\n      ");
      }
      return initializeApp.apply(undefined, args);
  };
  var firebase$1 = firebase;
  registerCoreComponents(firebase$1);

  exports.default = firebase$1;
  exports.firebase = firebase$1;
  //# sourceMappingURL=index.cjs.js.map
  });

  var firebase = unwrapExports(index_cjs$2);
  var index_cjs_1$2 = index_cjs$2.firebase;

  function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

  var firebase$1 = _interopDefault(index_cjs$2);

  var name = "firebase";
  var version = "7.6.1";

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  firebase$1.registerVersion(name, version, 'app');

  var index_cjs$3 = firebase$1;

  (function() {var k,aa="function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,c){a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value);},ba="undefined"!=typeof window&&window===this?this:"undefined"!=typeof global&&null!=global?global:this;function ca(a,b){if(b){var c=ba;a=a.split(".");for(var d=0;d<a.length-1;d++){var e=a[d];e in c||(c[e]={});c=c[e];}a=a[a.length-1];d=c[a];b=b(d);b!=d&&null!=b&&aa(c,a,{configurable:!0,writable:!0,value:b});}}
  function da(a){var b=0;return function(){return b<a.length?{done:!1,value:a[b++]}:{done:!0}}}function ea(a){var b="undefined"!=typeof Symbol&&Symbol.iterator&&a[Symbol.iterator];return b?b.call(a):{next:da(a)}}
  ca("Promise",function(a){function b(g){this.b=0;this.c=void 0;this.a=[];var h=this.f();try{g(h.resolve,h.reject);}catch(m){h.reject(m);}}function c(){this.a=null;}function d(g){return g instanceof b?g:new b(function(h){h(g);})}if(a)return a;c.prototype.b=function(g){if(null==this.a){this.a=[];var h=this;this.c(function(){h.g();});}this.a.push(g);};var e=ba.setTimeout;c.prototype.c=function(g){e(g,0);};c.prototype.g=function(){for(;this.a&&this.a.length;){var g=this.a;this.a=[];for(var h=0;h<g.length;++h){var m=
  g[h];g[h]=null;try{m();}catch(p){this.f(p);}}}this.a=null;};c.prototype.f=function(g){this.c(function(){throw g;});};b.prototype.f=function(){function g(p){return function(u){m||(m=!0,p.call(h,u));}}var h=this,m=!1;return {resolve:g(this.m),reject:g(this.g)}};b.prototype.m=function(g){if(g===this)this.g(new TypeError("A Promise cannot resolve to itself"));else if(g instanceof b)this.o(g);else{a:switch(typeof g){case "object":var h=null!=g;break a;case "function":h=!0;break a;default:h=!1;}h?this.u(g):this.h(g);}};
  b.prototype.u=function(g){var h=void 0;try{h=g.then;}catch(m){this.g(m);return}"function"==typeof h?this.v(h,g):this.h(g);};b.prototype.g=function(g){this.i(2,g);};b.prototype.h=function(g){this.i(1,g);};b.prototype.i=function(g,h){if(0!=this.b)throw Error("Cannot settle("+g+", "+h+"): Promise already settled in state"+this.b);this.b=g;this.c=h;this.l();};b.prototype.l=function(){if(null!=this.a){for(var g=0;g<this.a.length;++g)f.b(this.a[g]);this.a=null;}};var f=new c;b.prototype.o=function(g){var h=this.f();
  g.La(h.resolve,h.reject);};b.prototype.v=function(g,h){var m=this.f();try{g.call(h,m.resolve,m.reject);}catch(p){m.reject(p);}};b.prototype.then=function(g,h){function m(C,N){return "function"==typeof C?function(wa){try{p(C(wa));}catch(ld){u(ld);}}:N}var p,u,A=new b(function(C,N){p=C;u=N;});this.La(m(g,p),m(h,u));return A};b.prototype.catch=function(g){return this.then(void 0,g)};b.prototype.La=function(g,h){function m(){switch(p.b){case 1:g(p.c);break;case 2:h(p.c);break;default:throw Error("Unexpected state: "+
  p.b);}}var p=this;null==this.a?f.b(m):this.a.push(m);};b.resolve=d;b.reject=function(g){return new b(function(h,m){m(g);})};b.race=function(g){return new b(function(h,m){for(var p=ea(g),u=p.next();!u.done;u=p.next())d(u.value).La(h,m);})};b.all=function(g){var h=ea(g),m=h.next();return m.done?d([]):new b(function(p,u){function A(wa){return function(ld){C[wa]=ld;N--;0==N&&p(C);}}var C=[],N=0;do C.push(void 0),N++,d(m.value).La(A(C.length-1),u),m=h.next();while(!m.done)})};return b});
  var fa=fa||{},l=this||self;function n(a){return "string"==typeof a}function ha(a){return "boolean"==typeof a}var ia=/^[\w+/_-]+[=]{0,2}$/,ja=null;function ka(){}
  function la(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return "array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return "object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return "array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return "function"}else return "null";
  else if("function"==b&&"undefined"==typeof a.call)return "object";return b}function ma(a){return null===a}function na(a){return "array"==la(a)}function oa(a){var b=la(a);return "array"==b||"object"==b&&"number"==typeof a.length}function q(a){return "function"==la(a)}function r(a){var b=typeof a;return "object"==b&&null!=a||"function"==b}var pa="closure_uid_"+(1E9*Math.random()>>>0),qa=0;function ra(a,b,c){return a.call.apply(a.bind,arguments)}
  function sa(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var e=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(e,d);return a.apply(b,e)}}return function(){return a.apply(b,arguments)}}function t(a,b,c){Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?t=ra:t=sa;return t.apply(null,arguments)}
  function ta(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var d=c.slice();d.push.apply(d,arguments);return a.apply(this,d)}}var ua=Date.now||function(){return +new Date};function v(a,b){function c(){}c.prototype=b.prototype;a.qb=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.gd=function(d,e,f){for(var g=Array(arguments.length-2),h=2;h<arguments.length;h++)g[h-2]=arguments[h];return b.prototype[e].apply(d,g)};}function va(a){if(!a)return !1;try{return !!a.$goog_Thenable}catch(b){return !1}}function w(a){if(Error.captureStackTrace)Error.captureStackTrace(this,w);else{var b=Error().stack;b&&(this.stack=b);}a&&(this.message=String(a));}v(w,Error);w.prototype.name="CustomError";function xa(a,b){a=a.split("%s");for(var c="",d=a.length-1,e=0;e<d;e++)c+=a[e]+(e<b.length?b[e]:"%s");w.call(this,c+a[d]);}v(xa,w);xa.prototype.name="AssertionError";function ya(a,b){throw new xa("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));}function za(a,b){this.c=a;this.f=b;this.b=0;this.a=null;}za.prototype.get=function(){if(0<this.b){this.b--;var a=this.a;this.a=a.next;a.next=null;}else a=this.c();return a};function Aa(a,b){a.f(b);100>a.b&&(a.b++,b.next=a.a,a.a=b);}function Ba(){this.b=this.a=null;}var Da=new za(function(){return new Ca},function(a){a.reset();});Ba.prototype.add=function(a,b){var c=Da.get();c.set(a,b);this.b?this.b.next=c:this.a=c;this.b=c;};function Ea(){var a=Fa,b=null;a.a&&(b=a.a,a.a=a.a.next,a.a||(a.b=null),b.next=null);return b}function Ca(){this.next=this.b=this.a=null;}Ca.prototype.set=function(a,b){this.a=a;this.b=b;this.next=null;};Ca.prototype.reset=function(){this.next=this.b=this.a=null;};function Ga(a,b){a:{try{var c=a&&a.ownerDocument,d=c&&(c.defaultView||c.parentWindow);d=d||l;if(d.Element&&d.Location){var e=d;break a}}catch(g){}e=null;}if(e&&"undefined"!=typeof e[b]&&(!a||!(a instanceof e[b])&&(a instanceof e.Location||a instanceof e.Element))){if(r(a))try{var f=a.constructor.displayName||a.constructor.name||Object.prototype.toString.call(a);}catch(g){f="<object could not be stringified>";}else f=void 0===a?"undefined":null===a?"null":typeof a;ya("Argument is not a %s (or a non-Element, non-Location mock); got: %s",
  b,f);}}var Ha=Array.prototype.indexOf?function(a,b){return Array.prototype.indexOf.call(a,b,void 0)}:function(a,b){if(n(a))return n(b)&&1==b.length?a.indexOf(b,0):-1;for(var c=0;c<a.length;c++)if(c in a&&a[c]===b)return c;return -1},x=Array.prototype.forEach?function(a,b,c){Array.prototype.forEach.call(a,b,c);}:function(a,b,c){for(var d=a.length,e=n(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a);};function Ia(a,b){for(var c=n(a)?a.split(""):a,d=a.length-1;0<=d;--d)d in c&&b.call(void 0,c[d],d,a);}
  var Ja=Array.prototype.map?function(a,b){return Array.prototype.map.call(a,b,void 0)}:function(a,b){for(var c=a.length,d=Array(c),e=n(a)?a.split(""):a,f=0;f<c;f++)f in e&&(d[f]=b.call(void 0,e[f],f,a));return d},Ka=Array.prototype.some?function(a,b){return Array.prototype.some.call(a,b,void 0)}:function(a,b){for(var c=a.length,d=n(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a))return !0;return !1};
  function La(a){a:{var b=Ma;for(var c=a.length,d=n(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1;}return 0>b?null:n(a)?a.charAt(b):a[b]}function Na(a,b){return 0<=Ha(a,b)}function Oa(a,b){b=Ha(a,b);var c;(c=0<=b)&&Array.prototype.splice.call(a,b,1);return c}function Pa(a,b){var c=0;Ia(a,function(d,e){b.call(void 0,d,e,a)&&1==Array.prototype.splice.call(a,e,1).length&&c++;});}function Qa(a){return Array.prototype.concat.apply([],arguments)}
  function Ra(a){var b=a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return []}function Sa(a,b){for(var c in a)b.call(void 0,a[c],c,a);}function Ta(a){for(var b in a)return !1;return !0}function Ua(a){var b={},c;for(c in a)b[c]=a[c];return b}var Va="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Wa(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<Va.length;f++)c=Va[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c]);}}function Xa(a,b){this.a=a===Ya&&b||"";this.b=Za;}Xa.prototype.qa=!0;Xa.prototype.pa=function(){return this.a};Xa.prototype.toString=function(){return "Const{"+this.a+"}"};function $a(a){if(a instanceof Xa&&a.constructor===Xa&&a.b===Za)return a.a;ya("expected object of type Const, got '"+a+"'");return "type_error:Const"}var Za={},Ya={},ab=new Xa(Ya,"");function bb(){this.a="";this.b=cb;}bb.prototype.qa=!0;bb.prototype.pa=function(){return this.a.toString()};bb.prototype.toString=function(){return "TrustedResourceUrl{"+this.a+"}"};function db(a){if(a instanceof bb&&a.constructor===bb&&a.b===cb)return a.a;ya("expected object of type TrustedResourceUrl, got '"+a+"' of type "+la(a));return "type_error:TrustedResourceUrl"}
  function eb(a,b){var c=$a(a);if(!fb.test(c))throw Error("Invalid TrustedResourceUrl format: "+c);a=c.replace(gb,function(d,e){if(!Object.prototype.hasOwnProperty.call(b,e))throw Error('Found marker, "'+e+'", in format string, "'+c+'", but no valid label mapping found in args: '+JSON.stringify(b));d=b[e];return d instanceof Xa?$a(d):encodeURIComponent(String(d))});return hb(a)}var gb=/%{(\w+)}/g,fb=/^((https:)?\/\/[0-9a-z.:[\]-]+\/|\/[^/\\]|[^:/\\%]+\/|[^:/\\%]*[?#]|about:blank#)/i,cb={};
  function hb(a){var b=new bb;b.a=a;return b}var ib=String.prototype.trim?function(a){return a.trim()}:function(a){return /^[\s\xa0]*([\s\S]*?)[\s\xa0]*$/.exec(a)[1]},jb=/&/g,kb=/</g,lb=/>/g,mb=/"/g,nb=/'/g,ob=/\x00/g,pb=/[\x00&<>"']/;function y(a,b){return -1!=a.indexOf(b)}function qb(a,b){return a<b?-1:a>b?1:0}function rb(){this.a="";this.b=sb;}rb.prototype.qa=!0;rb.prototype.pa=function(){return this.a.toString()};rb.prototype.toString=function(){return "SafeUrl{"+this.a+"}"};function tb(a){if(a instanceof rb&&a.constructor===rb&&a.b===sb)return a.a;ya("expected object of type SafeUrl, got '"+a+"' of type "+la(a));return "type_error:SafeUrl"}var ub=/^(?:(?:https?|mailto|ftp):|[^:/?#]*(?:[/?#]|$))/i;
  function vb(a){if(a instanceof rb)return a;a="object"==typeof a&&a.qa?a.pa():String(a);ub.test(a)||(a="about:invalid#zClosurez");return wb(a)}var sb={};function wb(a){var b=new rb;b.a=a;return b}wb("about:blank");var xb;a:{var yb=l.navigator;if(yb){var zb=yb.userAgent;if(zb){xb=zb;break a}}xb="";}function z(a){return y(xb,a)}function Ab(){this.a="";this.b=Bb;}Ab.prototype.qa=!0;Ab.prototype.pa=function(){return this.a.toString()};Ab.prototype.toString=function(){return "SafeHtml{"+this.a+"}"};function Cb(a){if(a instanceof Ab&&a.constructor===Ab&&a.b===Bb)return a.a;ya("expected object of type SafeHtml, got '"+a+"' of type "+la(a));return "type_error:SafeHtml"}var Bb={};function Db(a){var b=new Ab;b.a=a;return b}Db("<!DOCTYPE html>");var Eb=Db("");Db("<br>");function Fb(a){var b=hb($a(ab));Ga(a,"HTMLIFrameElement");a.src=db(b).toString();}function Gb(a,b){Ga(a,"HTMLScriptElement");a.src=db(b);if(null===ja)b:{b=l.document;if((b=b.querySelector&&b.querySelector("script[nonce]"))&&(b=b.nonce||b.getAttribute("nonce"))&&ia.test(b)){ja=b;break b}ja="";}b=ja;b&&a.setAttribute("nonce",b);}function Hb(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")}function Ib(a){pb.test(a)&&(-1!=a.indexOf("&")&&(a=a.replace(jb,"&amp;")),-1!=a.indexOf("<")&&(a=a.replace(kb,"&lt;")),-1!=a.indexOf(">")&&(a=a.replace(lb,"&gt;")),-1!=a.indexOf('"')&&(a=a.replace(mb,"&quot;")),-1!=a.indexOf("'")&&(a=a.replace(nb,"&#39;")),-1!=a.indexOf("\x00")&&(a=a.replace(ob,"&#0;")));return a}function Jb(a){l.setTimeout(function(){throw a;},0);}var Kb;
  function Lb(){var a=l.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&!z("Presto")&&(a=function(){var e=document.createElement("IFRAME");e.style.display="none";Fb(e);document.documentElement.appendChild(e);var f=e.contentWindow;e=f.document;e.open();e.write(Cb(Eb));e.close();var g="callImmediate"+Math.random(),h="file:"==f.location.protocol?"*":f.location.protocol+"//"+f.location.host;e=t(function(m){if(("*"==h||m.origin==h)&&m.data==
  g)this.port1.onmessage();},this);f.addEventListener("message",e,!1);this.port1={};this.port2={postMessage:function(){f.postMessage(g,h);}};});if("undefined"!==typeof a&&!z("Trident")&&!z("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(void 0!==c.next){c=c.next;var e=c.yb;c.yb=null;e();}};return function(e){d.next={yb:e};d=d.next;b.port2.postMessage(0);}}return "undefined"!==typeof document&&"onreadystatechange"in document.createElement("SCRIPT")?function(e){var f=document.createElement("SCRIPT");
  f.onreadystatechange=function(){f.onreadystatechange=null;f.parentNode.removeChild(f);f=null;e();e=null;};document.documentElement.appendChild(f);}:function(e){l.setTimeout(e,0);}}function Mb(a,b){Nb||Ob();Pb||(Nb(),Pb=!0);Fa.add(a,b);}var Nb;function Ob(){if(l.Promise&&l.Promise.resolve){var a=l.Promise.resolve(void 0);Nb=function(){a.then(Qb);};}else Nb=function(){var b=Qb;!q(l.setImmediate)||l.Window&&l.Window.prototype&&!z("Edge")&&l.Window.prototype.setImmediate==l.setImmediate?(Kb||(Kb=Lb()),Kb(b)):l.setImmediate(b);};}var Pb=!1,Fa=new Ba;function Qb(){for(var a;a=Ea();){try{a.a.call(a.b);}catch(b){Jb(b);}Aa(Da,a);}Pb=!1;}function B(a,b){this.a=Rb;this.i=void 0;this.f=this.b=this.c=null;this.g=this.h=!1;if(a!=ka)try{var c=this;a.call(b,function(d){Sb(c,Tb,d);},function(d){if(!(d instanceof Ub))try{if(d instanceof Error)throw d;throw Error("Promise rejected.");}catch(e){}Sb(c,Vb,d);});}catch(d){Sb(this,Vb,d);}}var Rb=0,Tb=2,Vb=3;function Wb(){this.next=this.f=this.b=this.g=this.a=null;this.c=!1;}Wb.prototype.reset=function(){this.f=this.b=this.g=this.a=null;this.c=!1;};var Xb=new za(function(){return new Wb},function(a){a.reset();});
  function Yb(a,b,c){var d=Xb.get();d.g=a;d.b=b;d.f=c;return d}function D(a){if(a instanceof B)return a;var b=new B(ka);Sb(b,Tb,a);return b}function E(a){return new B(function(b,c){c(a);})}function Zb(a,b,c){$b(a,b,c,null)||Mb(ta(b,a));}function ac(a){return new B(function(b,c){var d=a.length,e=[];if(d)for(var f=function(p,u){d--;e[p]=u;0==d&&b(e);},g=function(p){c(p);},h=0,m;h<a.length;h++)m=a[h],Zb(m,ta(f,h),g);else b(e);})}
  function bc(a){return new B(function(b){var c=a.length,d=[];if(c)for(var e=function(h,m,p){c--;d[h]=m?{Gb:!0,value:p}:{Gb:!1,reason:p};0==c&&b(d);},f=0,g;f<a.length;f++)g=a[f],Zb(g,ta(e,f,!0),ta(e,f,!1));else b(d);})}B.prototype.then=function(a,b,c){return cc(this,q(a)?a:null,q(b)?b:null,c)};B.prototype.$goog_Thenable=!0;k=B.prototype;k.ka=function(a,b){a=Yb(a,a,b);a.c=!0;dc(this,a);return this};k.s=function(a,b){return cc(this,null,a,b)};
  k.cancel=function(a){this.a==Rb&&Mb(function(){var b=new Ub(a);ec(this,b);},this);};function ec(a,b){if(a.a==Rb)if(a.c){var c=a.c;if(c.b){for(var d=0,e=null,f=null,g=c.b;g&&(g.c||(d++,g.a==a&&(e=g),!(e&&1<d)));g=g.next)e||(f=g);e&&(c.a==Rb&&1==d?ec(c,b):(f?(d=f,d.next==c.f&&(c.f=d),d.next=d.next.next):fc(c),gc(c,e,Vb,b)));}a.c=null;}else Sb(a,Vb,b);}function dc(a,b){a.b||a.a!=Tb&&a.a!=Vb||hc(a);a.f?a.f.next=b:a.b=b;a.f=b;}
  function cc(a,b,c,d){var e=Yb(null,null,null);e.a=new B(function(f,g){e.g=b?function(h){try{var m=b.call(d,h);f(m);}catch(p){g(p);}}:f;e.b=c?function(h){try{var m=c.call(d,h);void 0===m&&h instanceof Ub?g(h):f(m);}catch(p){g(p);}}:g;});e.a.c=a;dc(a,e);return e.a}k.Oc=function(a){this.a=Rb;Sb(this,Tb,a);};k.Pc=function(a){this.a=Rb;Sb(this,Vb,a);};
  function Sb(a,b,c){a.a==Rb&&(a===c&&(b=Vb,c=new TypeError("Promise cannot resolve to itself")),a.a=1,$b(c,a.Oc,a.Pc,a)||(a.i=c,a.a=b,a.c=null,hc(a),b!=Vb||c instanceof Ub||ic(a,c)));}function $b(a,b,c,d){if(a instanceof B)return dc(a,Yb(b||ka,c||null,d)),!0;if(va(a))return a.then(b,c,d),!0;if(r(a))try{var e=a.then;if(q(e))return jc(a,e,b,c,d),!0}catch(f){return c.call(d,f),!0}return !1}
  function jc(a,b,c,d,e){function f(m){h||(h=!0,d.call(e,m));}function g(m){h||(h=!0,c.call(e,m));}var h=!1;try{b.call(a,g,f);}catch(m){f(m);}}function hc(a){a.h||(a.h=!0,Mb(a.Zb,a));}function fc(a){var b=null;a.b&&(b=a.b,a.b=b.next,b.next=null);a.b||(a.f=null);return b}k.Zb=function(){for(var a;a=fc(this);)gc(this,a,this.a,this.i);this.h=!1;};
  function gc(a,b,c,d){if(c==Vb&&b.b&&!b.c)for(;a&&a.g;a=a.c)a.g=!1;if(b.a)b.a.c=null,kc(b,c,d);else try{b.c?b.g.call(b.f):kc(b,c,d);}catch(e){lc.call(null,e);}Aa(Xb,b);}function kc(a,b,c){b==Tb?a.g.call(a.f,c):a.b&&a.b.call(a.f,c);}function ic(a,b){a.g=!0;Mb(function(){a.g&&lc.call(null,b);});}var lc=Jb;function Ub(a){w.call(this,a);}v(Ub,w);Ub.prototype.name="cancel";function mc(){this.va=this.va;this.la=this.la;}var nc=0;mc.prototype.va=!1;function pc(a){if(!a.va&&(a.va=!0,a.za(),0!=nc)){var b=a[pa]||(a[pa]=++qa);}}mc.prototype.za=function(){if(this.la)for(;this.la.length;)this.la.shift()();};function qc(a){qc[" "](a);return a}qc[" "]=ka;function rc(a,b){var c=sc;return Object.prototype.hasOwnProperty.call(c,a)?c[a]:c[a]=b(a)}var tc=z("Opera"),uc=z("Trident")||z("MSIE"),vc=z("Edge"),wc=vc||uc,xc=z("Gecko")&&!(y(xb.toLowerCase(),"webkit")&&!z("Edge"))&&!(z("Trident")||z("MSIE"))&&!z("Edge"),yc=y(xb.toLowerCase(),"webkit")&&!z("Edge");function zc(){var a=l.document;return a?a.documentMode:void 0}var Ac;
  a:{var Bc="",Cc=function(){var a=xb;if(xc)return /rv:([^\);]+)(\)|;)/.exec(a);if(vc)return /Edge\/([\d\.]+)/.exec(a);if(uc)return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(yc)return /WebKit\/(\S+)/.exec(a);if(tc)return /(?:Version)[ \/]?(\S+)/.exec(a)}();Cc&&(Bc=Cc?Cc[1]:"");if(uc){var Dc=zc();if(null!=Dc&&Dc>parseFloat(Bc)){Ac=String(Dc);break a}}Ac=Bc;}var sc={};
  function Ec(a){return rc(a,function(){for(var b=0,c=ib(String(Ac)).split("."),d=ib(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",h=d[f]||"";do{g=/(\d*)(\D*)(.*)/.exec(g)||["","","",""];h=/(\d*)(\D*)(.*)/.exec(h)||["","","",""];if(0==g[0].length&&0==h[0].length)break;b=qb(0==g[1].length?0:parseInt(g[1],10),0==h[1].length?0:parseInt(h[1],10))||qb(0==g[2].length,0==h[2].length)||qb(g[2],h[2]);g=g[3];h=h[3];}while(0==b)}return 0<=b})}var Fc;
  Fc=l.document&&uc?zc():void 0;var Gc=Object.freeze||function(a){return a};var Hc=!uc||9<=Number(Fc),Ic=uc&&!Ec("9"),Jc=function(){if(!l.addEventListener||!Object.defineProperty)return !1;var a=!1,b=Object.defineProperty({},"passive",{get:function(){a=!0;}});try{l.addEventListener("test",ka,b),l.removeEventListener("test",ka,b);}catch(c){}return a}();function F(a,b){this.type=a;this.b=this.target=b;this.Mb=!0;}F.prototype.preventDefault=function(){this.Mb=!1;};function Kc(a,b){F.call(this,a?a.type:"");this.relatedTarget=this.b=this.target=null;this.button=this.screenY=this.screenX=this.clientY=this.clientX=0;this.key="";this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.pointerId=0;this.pointerType="";this.a=null;if(a){var c=this.type=a.type,d=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.b=b;if(b=a.relatedTarget){if(xc){a:{try{qc(b.nodeName);var e=!0;break a}catch(f){}e=!1;}e||(b=null);}}else"mouseover"==
  c?b=a.fromElement:"mouseout"==c&&(b=a.toElement);this.relatedTarget=b;d?(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0):(this.clientX=void 0!==a.clientX?a.clientX:a.pageX,this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0);this.button=a.button;this.key=a.key||"";this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=a.shiftKey;this.metaKey=
  a.metaKey;this.pointerId=a.pointerId||0;this.pointerType=n(a.pointerType)?a.pointerType:Lc[a.pointerType]||"";this.a=a;a.defaultPrevented&&this.preventDefault();}}v(Kc,F);var Lc=Gc({2:"touch",3:"pen",4:"mouse"});Kc.prototype.preventDefault=function(){Kc.qb.preventDefault.call(this);var a=this.a;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,Ic)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1;}catch(b){}};Kc.prototype.f=function(){return this.a};var Mc="closure_listenable_"+(1E6*Math.random()|0),Nc=0;function Oc(a,b,c,d,e){this.listener=a;this.proxy=null;this.src=b;this.type=c;this.capture=!!d;this.Pa=e;this.key=++Nc;this.ta=this.Ka=!1;}function Pc(a){a.ta=!0;a.listener=null;a.proxy=null;a.src=null;a.Pa=null;}function Qc(a){this.src=a;this.a={};this.b=0;}Qc.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.a[f];a||(a=this.a[f]=[],this.b++);var g=Rc(a,b,d,e);-1<g?(b=a[g],c||(b.Ka=!1)):(b=new Oc(b,this.src,f,!!d,e),b.Ka=c,a.push(b));return b};function Sc(a,b){var c=b.type;c in a.a&&Oa(a.a[c],b)&&(Pc(b),0==a.a[c].length&&(delete a.a[c],a.b--));}function Rc(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.ta&&f.listener==b&&f.capture==!!c&&f.Pa==d)return e}return -1}var Tc="closure_lm_"+(1E6*Math.random()|0),Uc={};function Wc(a,b,c,d,e){if(d&&d.once)Xc(a,b,c,d,e);else if(na(b))for(var f=0;f<b.length;f++)Wc(a,b[f],c,d,e);else c=Yc(c),a&&a[Mc]?Zc(a,b,c,r(d)?!!d.capture:!!d,e):$c(a,b,c,!1,d,e);}
  function $c(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=r(e)?!!e.capture:!!e,h=ad(a);h||(a[Tc]=h=new Qc(a));c=h.add(b,c,d,g,f);if(!c.proxy){d=bd();c.proxy=d;d.src=a;d.listener=c;if(a.addEventListener)Jc||(e=g),void 0===e&&(e=!1),a.addEventListener(b.toString(),d,e);else if(a.attachEvent)a.attachEvent(cd(b.toString()),d);else if(a.addListener&&a.removeListener)a.addListener(d);else throw Error("addEventListener and attachEvent are unavailable.");}}
  function bd(){var a=dd,b=Hc?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b}function Xc(a,b,c,d,e){if(na(b))for(var f=0;f<b.length;f++)Xc(a,b[f],c,d,e);else c=Yc(c),a&&a[Mc]?ed(a,b,c,r(d)?!!d.capture:!!d,e):$c(a,b,c,!0,d,e);}
  function fd(a,b,c,d,e){if(na(b))for(var f=0;f<b.length;f++)fd(a,b[f],c,d,e);else(d=r(d)?!!d.capture:!!d,c=Yc(c),a&&a[Mc])?(a=a.u,b=String(b).toString(),b in a.a&&(f=a.a[b],c=Rc(f,c,d,e),-1<c&&(Pc(f[c]),Array.prototype.splice.call(f,c,1),0==f.length&&(delete a.a[b],a.b--)))):a&&(a=ad(a))&&(b=a.a[b.toString()],a=-1,b&&(a=Rc(b,c,d,e)),(c=-1<a?b[a]:null)&&gd(c));}
  function gd(a){if("number"!=typeof a&&a&&!a.ta){var b=a.src;if(b&&b[Mc])Sc(b.u,a);else{var c=a.type,d=a.proxy;b.removeEventListener?b.removeEventListener(c,d,a.capture):b.detachEvent?b.detachEvent(cd(c),d):b.addListener&&b.removeListener&&b.removeListener(d);(c=ad(b))?(Sc(c,a),0==c.b&&(c.src=null,b[Tc]=null)):Pc(a);}}}function cd(a){return a in Uc?Uc[a]:Uc[a]="on"+a}
  function hd(a,b,c,d){var e=!0;if(a=ad(a))if(b=a.a[b.toString()])for(b=b.concat(),a=0;a<b.length;a++){var f=b[a];f&&f.capture==c&&!f.ta&&(f=id(f,d),e=e&&!1!==f);}return e}function id(a,b){var c=a.listener,d=a.Pa||a.src;a.Ka&&gd(a);return c.call(d,b)}
  function dd(a,b){if(a.ta)return !0;if(!Hc){if(!b)a:{b=["window","event"];for(var c=l,d=0;d<b.length;d++)if(c=c[b[d]],null==c){b=null;break a}b=c;}d=b;b=new Kc(d,this);c=!0;if(!(0>d.keyCode||void 0!=d.returnValue)){a:{var e=!1;if(0==d.keyCode)try{d.keyCode=-1;break a}catch(g){e=!0;}if(e||void 0==d.returnValue)d.returnValue=!0;}d=[];for(e=b.b;e;e=e.parentNode)d.push(e);a=a.type;for(e=d.length-1;0<=e;e--){b.b=d[e];var f=hd(d[e],a,!0,b);c=c&&f;}for(e=0;e<d.length;e++)b.b=d[e],f=hd(d[e],a,!1,b),c=c&&f;}return c}return id(a,
  new Kc(b,this))}function ad(a){a=a[Tc];return a instanceof Qc?a:null}var jd="__closure_events_fn_"+(1E9*Math.random()>>>0);function Yc(a){if(q(a))return a;a[jd]||(a[jd]=function(b){return a.handleEvent(b)});return a[jd]}function G(){mc.call(this);this.u=new Qc(this);this.Sb=this;this.Xa=null;}v(G,mc);G.prototype[Mc]=!0;G.prototype.addEventListener=function(a,b,c,d){Wc(this,a,b,c,d);};G.prototype.removeEventListener=function(a,b,c,d){fd(this,a,b,c,d);};
  G.prototype.dispatchEvent=function(a){var b,c=this.Xa;if(c)for(b=[];c;c=c.Xa)b.push(c);c=this.Sb;var d=a.type||a;if(n(a))a=new F(a,c);else if(a instanceof F)a.target=a.target||c;else{var e=a;a=new F(d,c);Wa(a,e);}e=!0;if(b)for(var f=b.length-1;0<=f;f--){var g=a.b=b[f];e=kd(g,d,!0,a)&&e;}g=a.b=c;e=kd(g,d,!0,a)&&e;e=kd(g,d,!1,a)&&e;if(b)for(f=0;f<b.length;f++)g=a.b=b[f],e=kd(g,d,!1,a)&&e;return e};
  G.prototype.za=function(){G.qb.za.call(this);if(this.u){var a=this.u,c;for(c in a.a){for(var d=a.a[c],e=0;e<d.length;e++)Pc(d[e]);delete a.a[c];a.b--;}}this.Xa=null;};function Zc(a,b,c,d,e){a.u.add(String(b),c,!1,d,e);}function ed(a,b,c,d,e){a.u.add(String(b),c,!0,d,e);}
  function kd(a,b,c,d){b=a.u.a[String(b)];if(!b)return !0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.ta&&g.capture==c){var h=g.listener,m=g.Pa||g.src;g.Ka&&Sc(a.u,g);e=!1!==h.call(m,d)&&e;}}return e&&0!=d.Mb}function md(a,b,c){if(q(a))c&&(a=t(a,c));else if(a&&"function"==typeof a.handleEvent)a=t(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:l.setTimeout(a,b||0)}function nd(a){var b=null;return (new B(function(c,d){b=md(function(){c(void 0);},a);-1==b&&d(Error("Failed to schedule timer."));})).s(function(c){l.clearTimeout(b);throw c;})}function od(a){if(a.U&&"function"==typeof a.U)return a.U();if(n(a))return a.split("");if(oa(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}b=[];c=0;for(d in a)b[c++]=a[d];return b}function pd(a){if(a.X&&"function"==typeof a.X)return a.X();if(!a.U||"function"!=typeof a.U){if(oa(a)||n(a)){var b=[];a=a.length;for(var c=0;c<a;c++)b.push(c);return b}b=[];c=0;for(var d in a)b[c++]=d;return b}}
  function qd(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(oa(a)||n(a))x(a,b,void 0);else for(var c=pd(a),d=od(a),e=d.length,f=0;f<e;f++)b.call(void 0,d[f],c&&c[f],a);}function rd(a,b){this.b={};this.a=[];this.c=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1]);}else if(a)if(a instanceof rd)for(c=a.X(),d=0;d<c.length;d++)this.set(c[d],a.get(c[d]));else for(d in a)this.set(d,a[d]);}k=rd.prototype;k.U=function(){sd(this);for(var a=[],b=0;b<this.a.length;b++)a.push(this.b[this.a[b]]);return a};k.X=function(){sd(this);return this.a.concat()};
  k.clear=function(){this.b={};this.c=this.a.length=0;};function sd(a){if(a.c!=a.a.length){for(var b=0,c=0;b<a.a.length;){var d=a.a[b];td(a.b,d)&&(a.a[c++]=d);b++;}a.a.length=c;}if(a.c!=a.a.length){var e={};for(c=b=0;b<a.a.length;)d=a.a[b],td(e,d)||(a.a[c++]=d,e[d]=1),b++;a.a.length=c;}}k.get=function(a,b){return td(this.b,a)?this.b[a]:b};k.set=function(a,b){td(this.b,a)||(this.c++,this.a.push(a));this.b[a]=b;};
  k.forEach=function(a,b){for(var c=this.X(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this);}};function td(a,b){return Object.prototype.hasOwnProperty.call(a,b)}var ud=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#([\s\S]*))?$/;function vd(a,b){if(a){a=a.split("&");for(var c=0;c<a.length;c++){var d=a[c].indexOf("="),e=null;if(0<=d){var f=a[c].substring(0,d);e=a[c].substring(d+1);}else f=a[c];b(f,e?decodeURIComponent(e.replace(/\+/g," ")):"");}}}function wd(a,b){this.b=this.i=this.f="";this.l=null;this.g=this.c="";this.h=!1;var c;a instanceof wd?(this.h=void 0!==b?b:a.h,xd(this,a.f),this.i=a.i,this.b=a.b,yd(this,a.l),this.c=a.c,zd(this,Ad(a.a)),this.g=a.g):a&&(c=String(a).match(ud))?(this.h=!!b,xd(this,c[1]||"",!0),this.i=Bd(c[2]||""),this.b=Bd(c[3]||"",!0),yd(this,c[4]),this.c=Bd(c[5]||"",!0),zd(this,c[6]||"",!0),this.g=Bd(c[7]||"")):(this.h=!!b,this.a=new Cd(null,this.h));}
  wd.prototype.toString=function(){var a=[],b=this.f;b&&a.push(Dd(b,Ed,!0),":");var c=this.b;if(c||"file"==b)a.push("//"),(b=this.i)&&a.push(Dd(b,Ed,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.l,null!=c&&a.push(":",String(c));if(c=this.c)this.b&&"/"!=c.charAt(0)&&a.push("/"),a.push(Dd(c,"/"==c.charAt(0)?Fd:Gd,!0));(c=this.a.toString())&&a.push("?",c);(c=this.g)&&a.push("#",Dd(c,Hd));return a.join("")};
  wd.prototype.resolve=function(a){var b=new wd(this),c=!!a.f;c?xd(b,a.f):c=!!a.i;c?b.i=a.i:c=!!a.b;c?b.b=a.b:c=null!=a.l;var d=a.c;if(c)yd(b,a.l);else if(c=!!a.c){if("/"!=d.charAt(0))if(this.b&&!this.c)d="/"+d;else{var e=b.c.lastIndexOf("/");-1!=e&&(d=b.c.substr(0,e+1)+d);}e=d;if(".."==e||"."==e)d="";else if(y(e,"./")||y(e,"/.")){d=0==e.lastIndexOf("/",0);e=e.split("/");for(var f=[],g=0;g<e.length;){var h=e[g++];"."==h?d&&g==e.length&&f.push(""):".."==h?((1<f.length||1==f.length&&""!=f[0])&&f.pop(),
  d&&g==e.length&&f.push("")):(f.push(h),d=!0);}d=f.join("/");}else d=e;}c?b.c=d:c=""!==a.a.toString();c?zd(b,Ad(a.a)):c=!!a.g;c&&(b.g=a.g);return b};function xd(a,b,c){a.f=c?Bd(b,!0):b;a.f&&(a.f=a.f.replace(/:$/,""));}function yd(a,b){if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.l=b;}else a.l=null;}function zd(a,b,c){b instanceof Cd?(a.a=b,Id(a.a,a.h)):(c||(b=Dd(b,Jd)),a.a=new Cd(b,a.h));}function H(a,b,c){a.a.set(b,c);}function Kd(a,b){return a.a.get(b)}
  function Ld(a){return a instanceof wd?new wd(a):new wd(a,void 0)}function Md(a,b){var c=new wd(null,void 0);xd(c,"https");a&&(c.b=a);b&&(c.c=b);return c}function Bd(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function Dd(a,b,c){return n(a)?(a=encodeURI(a).replace(b,Nd),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function Nd(a){a=a.charCodeAt(0);return "%"+(a>>4&15).toString(16)+(a&15).toString(16)}
  var Ed=/[#\/\?@]/g,Gd=/[#\?:]/g,Fd=/[#\?]/g,Jd=/[#\?@]/g,Hd=/#/g;function Cd(a,b){this.b=this.a=null;this.c=a||null;this.f=!!b;}function Od(a){a.a||(a.a=new rd,a.b=0,a.c&&vd(a.c,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c);}));}function Pd(a){var b=pd(a);if("undefined"==typeof b)throw Error("Keys are undefined");var c=new Cd(null,void 0);a=od(a);for(var d=0;d<b.length;d++){var e=b[d],f=a[d];na(f)?Qd(c,e,f):c.add(e,f);}return c}k=Cd.prototype;
  k.add=function(a,b){Od(this);this.c=null;a=Rd(this,a);var c=this.a.get(a);c||this.a.set(a,c=[]);c.push(b);this.b+=1;return this};function Sd(a,b){Od(a);b=Rd(a,b);td(a.a.b,b)&&(a.c=null,a.b-=a.a.get(b).length,a=a.a,td(a.b,b)&&(delete a.b[b],a.c--,a.a.length>2*a.c&&sd(a)));}k.clear=function(){this.a=this.c=null;this.b=0;};function Td(a,b){Od(a);b=Rd(a,b);return td(a.a.b,b)}k.forEach=function(a,b){Od(this);this.a.forEach(function(c,d){x(c,function(e){a.call(b,e,d,this);},this);},this);};
  k.X=function(){Od(this);for(var a=this.a.U(),b=this.a.X(),c=[],d=0;d<b.length;d++)for(var e=a[d],f=0;f<e.length;f++)c.push(b[d]);return c};k.U=function(a){Od(this);var b=[];if(n(a))Td(this,a)&&(b=Qa(b,this.a.get(Rd(this,a))));else{a=this.a.U();for(var c=0;c<a.length;c++)b=Qa(b,a[c]);}return b};k.set=function(a,b){Od(this);this.c=null;a=Rd(this,a);Td(this,a)&&(this.b-=this.a.get(a).length);this.a.set(a,[b]);this.b+=1;return this};
  k.get=function(a,b){if(!a)return b;a=this.U(a);return 0<a.length?String(a[0]):b};function Qd(a,b,c){Sd(a,b);0<c.length&&(a.c=null,a.a.set(Rd(a,b),Ra(c)),a.b+=c.length);}k.toString=function(){if(this.c)return this.c;if(!this.a)return "";for(var a=[],b=this.a.X(),c=0;c<b.length;c++){var d=b[c],e=encodeURIComponent(String(d));d=this.U(d);for(var f=0;f<d.length;f++){var g=e;""!==d[f]&&(g+="="+encodeURIComponent(String(d[f])));a.push(g);}}return this.c=a.join("&")};
  function Ad(a){var b=new Cd;b.c=a.c;a.a&&(b.a=new rd(a.a),b.b=a.b);return b}function Rd(a,b){b=String(b);a.f&&(b=b.toLowerCase());return b}function Id(a,b){b&&!a.f&&(Od(a),a.c=null,a.a.forEach(function(c,d){var e=d.toLowerCase();d!=e&&(Sd(this,d),Qd(this,e,c));},a));a.f=b;}var Ud=!uc||9<=Number(Fc);function Vd(a){var b=document;return n(a)?b.getElementById(a):a}function Wd(a,b){Sa(b,function(c,d){c&&"object"==typeof c&&c.qa&&(c=c.pa());"style"==d?a.style.cssText=c:"class"==d?a.className=c:"for"==d?a.htmlFor=c:Xd.hasOwnProperty(d)?a.setAttribute(Xd[d],c):0==d.lastIndexOf("aria-",0)||0==d.lastIndexOf("data-",0)?a.setAttribute(d,c):a[d]=c;});}
  var Xd={cellpadding:"cellPadding",cellspacing:"cellSpacing",colspan:"colSpan",frameborder:"frameBorder",height:"height",maxlength:"maxLength",nonce:"nonce",role:"role",rowspan:"rowSpan",type:"type",usemap:"useMap",valign:"vAlign",width:"width"};
  function Yd(a,b,c){var d=arguments,e=document,f=String(d[0]),g=d[1];if(!Ud&&g&&(g.name||g.type)){f=["<",f];g.name&&f.push(' name="',Ib(g.name),'"');if(g.type){f.push(' type="',Ib(g.type),'"');var h={};Wa(h,g);delete h.type;g=h;}f.push(">");f=f.join("");}f=e.createElement(f);g&&(n(g)?f.className=g:na(g)?f.className=g.join(" "):Wd(f,g));2<d.length&&Zd(e,f,d);return f}
  function Zd(a,b,c){function d(g){g&&b.appendChild(n(g)?a.createTextNode(g):g);}for(var e=2;e<c.length;e++){var f=c[e];!oa(f)||r(f)&&0<f.nodeType?d(f):x($d(f)?Ra(f):f,d);}}function $d(a){if(a&&"number"==typeof a.length){if(r(a))return "function"==typeof a.item||"string"==typeof a.item;if(q(a))return "function"==typeof a.item}return !1}function ae(a){var b=[];be(new ce,a,b);return b.join("")}function ce(){}
  function be(a,b,c){if(null==b)c.push("null");else{if("object"==typeof b){if(na(b)){var d=b;b=d.length;c.push("[");for(var e="",f=0;f<b;f++)c.push(e),be(a,d[f],c),e=",";c.push("]");return}if(b instanceof String||b instanceof Number||b instanceof Boolean)b=b.valueOf();else{c.push("{");e="";for(d in b)Object.prototype.hasOwnProperty.call(b,d)&&(f=b[d],"function"!=typeof f&&(c.push(e),de(d,c),c.push(":"),be(a,f,c),e=","));c.push("}");return}}switch(typeof b){case "string":de(b,c);break;case "number":c.push(isFinite(b)&&
  !isNaN(b)?String(b):"null");break;case "boolean":c.push(String(b));break;case "function":c.push("null");break;default:throw Error("Unknown type: "+typeof b);}}}var ee={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},fe=/\uffff/.test("\uffff")?/[\\"\x00-\x1f\x7f-\uffff]/g:/[\\"\x00-\x1f\x7f-\xff]/g;
  function de(a,b){b.push('"',a.replace(fe,function(c){var d=ee[c];d||(d="\\u"+(c.charCodeAt(0)|65536).toString(16).substr(1),ee[c]=d);return d}),'"');}function ge(){var a=I();return uc&&!!Fc&&11==Fc||/Edge\/\d+/.test(a)}function he(){return l.window&&l.window.location.href||self&&self.location&&self.location.href||""}function ie(a,b){b=b||l.window;var c="about:blank";a&&(c=tb(vb(a)).toString());b.location.href=c;}function je(a,b){var c=[],d;for(d in a)d in b?typeof a[d]!=typeof b[d]?c.push(d):"object"==typeof a[d]&&null!=a[d]&&null!=b[d]?0<je(a[d],b[d]).length&&c.push(d):a[d]!==b[d]&&c.push(d):c.push(d);for(d in b)d in a||c.push(d);return c}
  function ke(){var a=I();a=le(a)!=me?null:(a=a.match(/\sChrome\/(\d+)/i))&&2==a.length?parseInt(a[1],10):null;return a&&30>a?!1:!uc||!Fc||9<Fc}function ne(a){a=(a||I()).toLowerCase();return a.match(/android/)||a.match(/webos/)||a.match(/iphone|ipad|ipod/)||a.match(/blackberry/)||a.match(/windows phone/)||a.match(/iemobile/)?!0:!1}function oe(a){a=a||l.window;try{a.close();}catch(b){}}
  function pe(a,b,c){var d=Math.floor(1E9*Math.random()).toString();b=b||500;c=c||600;var e=(window.screen.availHeight-c)/2,f=(window.screen.availWidth-b)/2;b={width:b,height:c,top:0<e?e:0,left:0<f?f:0,location:!0,resizable:!0,statusbar:!0,toolbar:!1};c=I().toLowerCase();d&&(b.target=d,y(c,"crios/")&&(b.target="_blank"));le(I())==qe&&(a=a||"http://localhost",b.scrollbars=!0);c=a||"";(a=b)||(a={});d=window;b=c instanceof rb?c:vb("undefined"!=typeof c.href?c.href:String(c));c=a.target||c.target;e=[];
  for(g in a)switch(g){case "width":case "height":case "top":case "left":e.push(g+"="+a[g]);break;case "target":case "noopener":case "noreferrer":break;default:e.push(g+"="+(a[g]?1:0));}var g=e.join(",");(z("iPhone")&&!z("iPod")&&!z("iPad")||z("iPad")||z("iPod"))&&d.navigator&&d.navigator.standalone&&c&&"_self"!=c?(g=d.document.createElement("A"),Ga(g,"HTMLAnchorElement"),b instanceof rb||b instanceof rb||(b="object"==typeof b&&b.qa?b.pa():String(b),ub.test(b)||(b="about:invalid#zClosurez"),b=wb(b)),
  g.href=tb(b),g.setAttribute("target",c),a.noreferrer&&g.setAttribute("rel","noreferrer"),a=document.createEvent("MouseEvent"),a.initMouseEvent("click",!0,!0,d,1),g.dispatchEvent(a),g={}):a.noreferrer?(g=d.open("",c,g),a=tb(b).toString(),g&&(wc&&y(a,";")&&(a="'"+a.replace(/'/g,"%27")+"'"),g.opener=null,a=Db('<meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0; url='+Ib(a)+'">'),g.document.write(Cb(a)),g.document.close())):(g=d.open(tb(b).toString(),c,g))&&a.noopener&&
  (g.opener=null);if(g)try{g.focus();}catch(h){}return g}function re(a){return new B(function(b){function c(){nd(2E3).then(function(){if(!a||a.closed)b();else return c()});}return c()})}var se=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,te=/^[^@]+@[^@]+$/;function ue(){var a=null;return (new B(function(b){"complete"==l.document.readyState?b():(a=function(){b();},Xc(window,"load",a));})).s(function(b){fd(window,"load",a);throw b;})}
  function ve(){return we(void 0)?ue().then(function(){return new B(function(a,b){var c=l.document,d=setTimeout(function(){b(Error("Cordova framework is not ready."));},1E3);c.addEventListener("deviceready",function(){clearTimeout(d);a();},!1);})}):E(Error("Cordova must run in an Android or iOS file scheme."))}function we(a){a=a||I();return !("file:"!==xe()&&"ionic:"!==xe()||!a.toLowerCase().match(/iphone|ipad|ipod|android/))}function ye(){var a=l.window;try{return !(!a||a==a.top)}catch(b){return !1}}
  function ze(){return "undefined"!==typeof l.WorkerGlobalScope&&"function"===typeof l.importScripts}function Ae(){return firebase.INTERNAL.hasOwnProperty("reactNative")?"ReactNative":firebase.INTERNAL.hasOwnProperty("node")?"Node":ze()?"Worker":"Browser"}function Be(){var a=Ae();return "ReactNative"===a||"Node"===a}function Ce(){for(var a=50,b=[];0<a;)b.push("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(62*Math.random()))),a--;return b.join("")}
  var qe="Firefox",me="Chrome";
  function le(a){var b=a.toLowerCase();if(y(b,"opera/")||y(b,"opr/")||y(b,"opios/"))return "Opera";if(y(b,"iemobile"))return "IEMobile";if(y(b,"msie")||y(b,"trident/"))return "IE";if(y(b,"edge/"))return "Edge";if(y(b,"firefox/"))return qe;if(y(b,"silk/"))return "Silk";if(y(b,"blackberry"))return "Blackberry";if(y(b,"webos"))return "Webos";if(!y(b,"safari/")||y(b,"chrome/")||y(b,"crios/")||y(b,"android"))if(!y(b,"chrome/")&&!y(b,"crios/")||y(b,"edge/")){if(y(b,"android"))return "Android";if((a=a.match(/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/))&&
  2==a.length)return a[1]}else return me;else return "Safari";return "Other"}var De={Wc:"FirebaseCore-web",Yc:"FirebaseUI-web"};function Ee(a,b){b=b||[];var c=[],d={},e;for(e in De)d[De[e]]=!0;for(e=0;e<b.length;e++)"undefined"!==typeof d[b[e]]&&(delete d[b[e]],c.push(b[e]));c.sort();b=c;b.length||(b=["FirebaseCore-web"]);c=Ae();"Browser"===c?(d=I(),c=le(d)):"Worker"===c&&(d=I(),c=le(d)+"-"+c);return c+"/JsCore/"+a+"/"+b.join(",")}function I(){return l.navigator&&l.navigator.userAgent||""}
  function J(a,b){a=a.split(".");b=b||l;for(var c=0;c<a.length&&"object"==typeof b&&null!=b;c++)b=b[a[c]];c!=a.length&&(b=void 0);return b}function Fe(){try{var a=l.localStorage,b=Ge();if(a)return a.setItem(b,"1"),a.removeItem(b),ge()?!!l.indexedDB:!0}catch(c){return ze()&&!!l.indexedDB}return !1}function He(){return (Ie()||"chrome-extension:"===xe()||we())&&!Be()&&Fe()&&!ze()}function Ie(){return "http:"===xe()||"https:"===xe()}function xe(){return l.location&&l.location.protocol||null}
  function Je(a){a=a||I();return ne(a)||le(a)==qe?!1:!0}function Ke(a){return "undefined"===typeof a?null:ae(a)}function Le(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&null!==a[c]&&void 0!==a[c]&&(b[c]=a[c]);return b}function Me(a){if(null!==a)return JSON.parse(a)}function Ge(a){return a?a:Math.floor(1E9*Math.random()).toString()}function Ne(a){a=a||I();return "Safari"==le(a)||a.toLowerCase().match(/iphone|ipad|ipod/)?!1:!0}
  function Oe(){var a=l.___jsl;if(a&&a.H)for(var b in a.H)if(a.H[b].r=a.H[b].r||[],a.H[b].L=a.H[b].L||[],a.H[b].r=a.H[b].L.concat(),a.CP)for(var c=0;c<a.CP.length;c++)a.CP[c]=null;}function Pe(a,b){if(a>b)throw Error("Short delay should be less than long delay!");this.a=a;this.c=b;a=I();b=Ae();this.b=ne(a)||"ReactNative"===b;}
  Pe.prototype.get=function(){var a=l.navigator;return (a&&"boolean"===typeof a.onLine&&(Ie()||"chrome-extension:"===xe()||"undefined"!==typeof a.connection)?a.onLine:1)?this.b?this.c:this.a:Math.min(5E3,this.a)};function Qe(){var a=l.document;return a&&"undefined"!==typeof a.visibilityState?"visible"==a.visibilityState:!0}
  function Re(){var a=l.document,b=null;return Qe()||!a?D():(new B(function(c){b=function(){Qe()&&(a.removeEventListener("visibilitychange",b,!1),c());};a.addEventListener("visibilitychange",b,!1);})).s(function(c){a.removeEventListener("visibilitychange",b,!1);throw c;})}function Se(a){try{var b=new Date(parseInt(a,10));if(!isNaN(b.getTime())&&!/[^0-9]/.test(a))return b.toUTCString()}catch(c){}return null}function Te(){return !(!J("fireauth.oauthhelper",l)&&!J("fireauth.iframe",l))}
  function Ue(){var a=l.navigator;return a&&a.serviceWorker&&a.serviceWorker.controller||null}function Ve(){var a=l.navigator;return a&&a.serviceWorker?D().then(function(){return a.serviceWorker.ready}).then(function(b){return b.active||null}).s(function(){return null}):D(null)}var We={};function Xe(a){We[a]||(We[a]=!0,"undefined"!==typeof console&&"function"===typeof console.warn&&console.warn(a));}var Ye;try{var Ze={};Object.defineProperty(Ze,"abcd",{configurable:!0,enumerable:!0,value:1});Object.defineProperty(Ze,"abcd",{configurable:!0,enumerable:!0,value:2});Ye=2==Ze.abcd;}catch(a){Ye=!1;}function K(a,b,c){Ye?Object.defineProperty(a,b,{configurable:!0,enumerable:!0,value:c}):a[b]=c;}function L(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&K(a,c,b[c]);}function $e(a){var b={};L(b,a);return b}function af(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&(b[c]=a[c]);return b}
  function bf(a,b){if(!b||!b.length)return !0;if(!a)return !1;for(var c=0;c<b.length;c++){var d=a[b[c]];if(void 0===d||null===d||""===d)return !1}return !0}function cf(a){var b=a;if("object"==typeof a&&null!=a){b="length"in a?[]:{};for(var c in a)K(b,c,cf(a[c]));}return b}function df(a){var b={},c=a[ef],d=a[ff];a=a[gf];if(!a||a!=hf&&!c)throw Error("Invalid provider user info!");b[jf]=d||null;b[kf]=c||null;K(this,lf,a);K(this,mf,cf(b));}var hf="EMAIL_SIGNIN",ef="email",ff="newEmail",gf="requestType",kf="email",jf="fromEmail",mf="data",lf="operation";function M(a,b){this.code=nf+a;this.message=b||of[a]||"";}v(M,Error);M.prototype.A=function(){return {code:this.code,message:this.message}};M.prototype.toJSON=function(){return this.A()};function pf(a){var b=a&&a.code;return b?new M(b.substring(nf.length),a.message):null}
  var nf="auth/",of={"admin-restricted-operation":"This operation is restricted to administrators only.","argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","app-not-installed":"The requested mobile application corresponding to the identifier (Android package name or iOS bundle ID) provided is not installed on this device.",
  "captcha-check-failed":"The reCAPTCHA response token provided is either invalid, expired, already used or the domain associated with it does not match the list of whitelisted domains.","code-expired":"The SMS code has expired. Please re-send the verification code to try again.","cordova-not-ready":"Cordova framework is not ready.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.",
  "requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.","dynamic-link-not-activated":"Please activate Dynamic Links in the Firebase Console and agree to the terms and conditions.","email-already-in-use":"The email address is already in use by another account.","expired-action-code":"The action code has expired. ","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.",
  "internal-error":"An internal error has occurred.","invalid-app-credential":"The phone verification request contains an invalid application verifier. The reCAPTCHA token response is either invalid or expired.","invalid-app-id":"The mobile app identifier is not registed for the current project.","invalid-user-token":"This user's credential isn't valid for this project. This can happen if the user's token has been tampered with, or if the user isn't for the project associated with this API key.","invalid-auth-event":"An internal error has occurred.",
  "invalid-verification-code":"The SMS verification code used to create the phone auth credential is invalid. Please resend the verification code sms and be sure use the verification code provided by the user.","invalid-continue-uri":"The continue URL provided in the request is invalid.","invalid-cordova-configuration":"The following Cordova plugins must be installed to enable OAuth sign-in: cordova-plugin-buildinfo, cordova-universal-links-plugin, cordova-plugin-browsertab, cordova-plugin-inappbrowser and cordova-plugin-customurlscheme.",
  "invalid-custom-token":"The custom token format is incorrect. Please check the documentation.","invalid-dynamic-link-domain":"The provided dynamic link domain is not configured or authorized for the current project.","invalid-email":"The email address is badly formatted.","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-cert-hash":"The SHA-1 certificate hash provided is invalid.","invalid-credential":"The supplied auth credential is malformed or has expired.",
  "invalid-message-payload":"The email template corresponding to this action contains invalid characters in its message. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","invalid-oauth-client-id":"The OAuth client ID provided is either invalid or does not match the specified API key.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.",
  "invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","invalid-persistence-type":"The specified persistence type is invalid. It can only be local, session or none.","invalid-phone-number":"The format of the phone number provided is incorrect. Please enter the phone number in a format that can be parsed into E.164 format. E.164 phone numbers are written in the format [+][country code][subscriber number including area code].",
  "invalid-provider-id":"The specified provider ID is invalid.","invalid-recipient-email":"The email corresponding to this action failed to send as the provided recipient email address is invalid.","invalid-sender":"The email template corresponding to this action contains an invalid sender email or name. Please fix by going to the Auth email templates section in the Firebase Console.","invalid-verification-id":"The verification ID used to create the phone auth credential is invalid.","invalid-tenant-id":"The Auth instance's tenant ID is invalid.",
  "missing-android-pkg-name":"An Android Package Name must be provided if the Android App is required to be installed.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","missing-app-credential":"The phone verification request is missing an application verifier assertion. A reCAPTCHA response token needs to be provided.","missing-verification-code":"The phone auth credential was created with an empty SMS verification code.",
  "missing-continue-uri":"A continue URL must be provided in the request.","missing-iframe-start":"An internal error has occurred.","missing-ios-bundle-id":"An iOS Bundle ID must be provided if an App Store ID is provided.","missing-or-invalid-nonce":"The request does not contain a valid nonce. This can occur if the SHA-256 hash of the provided raw nonce does not match the hashed nonce in the ID token payload.","missing-phone-number":"To send verification codes, provide a phone number for the recipient.",
  "missing-verification-id":"The phone auth credential was created with an empty verification ID.","app-deleted":"This instance of FirebaseApp has been deleted.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.","network-request-failed":"A network error (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal error has occurred.",
  "no-such-provider":"User was not linked to an account with the given provider.","null-user":"A null user object was provided as the argument for an operation which requires a non-null user object.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http, https or chrome-extension and web storage must be enabled.',
  "popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.","popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.","quota-exceeded":"The project's quota for this operation has been exceeded.","redirect-cancelled-by-user":"The redirect operation has been cancelled by the user before finalizing.","redirect-operation-pending":"A redirect sign-in operation is already pending.",
  "rejected-credential":"The request contains malformed or mismatching credentials.","tenant-id-mismatch":"The provided tenant ID does not match the Auth instance's tenant ID",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.","unauthorized-continue-uri":"The domain of the continue URL is not whitelisted.  Please whitelist the domain in the Firebase console.",
  "unsupported-persistence-type":"The current environment does not support the specified persistence type.","unsupported-tenant-operation":"This operation is not supported in a multi-tenant context.","user-cancelled":"The user did not grant your application the permissions it requested.","user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.",
  "user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported or 3rd party cookies and data may be disabled."};function qf(a){a=Ld(a);var b=Kd(a,rf)||null,c=Kd(a,sf)||null,d=Kd(a,tf)||null;d=d?uf[d]||null:null;if(!b||!c||!d)throw new M("argument-error",rf+", "+sf+"and "+tf+" are required in a valid action code URL.");L(this,{apiKey:b,operation:d,code:c,continueUrl:Kd(a,vf)||null,languageCode:Kd(a,wf)||null,tenantId:Kd(a,xf)||null});}var rf="apiKey",sf="oobCode",vf="continueUrl",wf="languageCode",tf="mode",xf="tenantId",uf={recoverEmail:"RECOVER_EMAIL",resetPassword:"PASSWORD_RESET",signIn:hf,verifyEmail:"VERIFY_EMAIL"};
  function yf(a){try{return new qf(a)}catch(b){return null}}function zf(a){var b=a[Af];if("undefined"===typeof b)throw new M("missing-continue-uri");if("string"!==typeof b||"string"===typeof b&&!b.length)throw new M("invalid-continue-uri");this.h=b;this.b=this.a=null;this.g=!1;var c=a[Bf];if(c&&"object"===typeof c){b=c[Cf];var d=c[Df];c=c[Ef];if("string"===typeof b&&b.length){this.a=b;if("undefined"!==typeof d&&"boolean"!==typeof d)throw new M("argument-error",Df+" property must be a boolean when specified.");this.g=!!d;if("undefined"!==typeof c&&("string"!==
  typeof c||"string"===typeof c&&!c.length))throw new M("argument-error",Ef+" property must be a non empty string when specified.");this.b=c||null;}else{if("undefined"!==typeof b)throw new M("argument-error",Cf+" property must be a non empty string when specified.");if("undefined"!==typeof d||"undefined"!==typeof c)throw new M("missing-android-pkg-name");}}else if("undefined"!==typeof c)throw new M("argument-error",Bf+" property must be a non null object when specified.");this.f=null;if((b=a[Ff])&&"object"===
  typeof b)if(b=b[Gf],"string"===typeof b&&b.length)this.f=b;else{if("undefined"!==typeof b)throw new M("argument-error",Gf+" property must be a non empty string when specified.");}else if("undefined"!==typeof b)throw new M("argument-error",Ff+" property must be a non null object when specified.");b=a[Hf];if("undefined"!==typeof b&&"boolean"!==typeof b)throw new M("argument-error",Hf+" property must be a boolean when specified.");this.c=!!b;a=a[If];if("undefined"!==typeof a&&("string"!==typeof a||"string"===
  typeof a&&!a.length))throw new M("argument-error",If+" property must be a non empty string when specified.");this.i=a||null;}var Bf="android",If="dynamicLinkDomain",Hf="handleCodeInApp",Ff="iOS",Af="url",Df="installApp",Ef="minimumVersion",Cf="packageName",Gf="bundleId";
  function Jf(a){var b={};b.continueUrl=a.h;b.canHandleCodeInApp=a.c;if(b.androidPackageName=a.a)b.androidMinimumVersion=a.b,b.androidInstallApp=a.g;b.iOSBundleId=a.f;b.dynamicLinkDomain=a.i;for(var c in b)null===b[c]&&delete b[c];return b}function Kf(a){return Ja(a,function(b){b=b.toString(16);return 1<b.length?b:"0"+b}).join("")}var Lf=null,Mf=null;function Nf(a){var b="";Of(a,function(c){b+=String.fromCharCode(c);});return b}function Of(a,b){function c(m){for(;d<a.length;){var p=a.charAt(d++),u=Mf[p];if(null!=u)return u;if(!/^[\s\xa0]*$/.test(p))throw Error("Unknown base64 encoding at char: "+p);}return m}Pf();for(var d=0;;){var e=c(-1),f=c(0),g=c(64),h=c(64);if(64===h&&-1===e)break;b(e<<2|f>>4);64!=g&&(b(f<<4&240|g>>2),64!=h&&b(g<<6&192|h));}}
  function Pf(){if(!Lf){Lf={};Mf={};for(var a=0;65>a;a++)Lf[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),Mf[Lf[a]]=a,62<=a&&(Mf["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a)]=a);}}function Qf(a){this.f=a.sub;this.a=a.provider_id||a.firebase&&a.firebase.sign_in_provider||null;this.c=a.firebase&&a.firebase.tenant||null;this.b=!!a.is_anonymous||"anonymous"==this.a;}Qf.prototype.R=function(){return this.c};Qf.prototype.g=function(){return this.b};function Rf(a){return (a=Sf(a))&&a.sub&&a.iss&&a.aud&&a.exp?new Qf(a):null}
  function Sf(a){if(!a)return null;a=a.split(".");if(3!=a.length)return null;a=a[1];for(var b=(4-a.length%4)%4,c=0;c<b;c++)a+=".";try{return JSON.parse(Nf(a))}catch(d){}return null}var Tf={bd:{cb:"https://www.googleapis.com/identitytoolkit/v3/relyingparty/",ib:"https://securetoken.googleapis.com/v1/token",id:"p"},dd:{cb:"https://staging-www.sandbox.googleapis.com/identitytoolkit/v3/relyingparty/",ib:"https://staging-securetoken.sandbox.googleapis.com/v1/token",id:"s"},ed:{cb:"https://www-googleapis-test.sandbox.google.com/identitytoolkit/v3/relyingparty/",ib:"https://test-securetoken.sandbox.googleapis.com/v1/token",id:"t"}};
  function Uf(a){for(var b in Tf)if(Tf[b].id===a)return a=Tf[b],{firebaseEndpoint:a.cb,secureTokenEndpoint:a.ib};return null}var Vf;Vf=Uf("__EID__")?"__EID__":void 0;var Wf="oauth_consumer_key oauth_nonce oauth_signature oauth_signature_method oauth_timestamp oauth_token oauth_version".split(" "),Xf=["client_id","response_type","scope","redirect_uri","state"],Yf={Xc:{Ea:"locale",sa:700,ra:600,Fa:"facebook.com",Qa:Xf},Zc:{Ea:null,sa:500,ra:750,Fa:"github.com",Qa:Xf},$c:{Ea:"hl",sa:515,ra:680,Fa:"google.com",Qa:Xf},fd:{Ea:"lang",sa:485,ra:705,Fa:"twitter.com",Qa:Wf},Vc:{Ea:"locale",sa:600,ra:600,Fa:"apple.com",Qa:[]}};
  function Zf(a){for(var b in Yf)if(Yf[b].Fa==a)return Yf[b];return null}function $f(a){var b={};b["facebook.com"]=ag;b["google.com"]=bg;b["github.com"]=cg;b["twitter.com"]=dg;var c=a&&a[eg];try{if(c)return b[c]?new b[c](a):new fg(a);if("undefined"!==typeof a[gg])return new hg(a)}catch(d){}return null}var gg="idToken",eg="providerId";
  function hg(a){var b=a[eg];if(!b&&a[gg]){var c=Rf(a[gg]);c&&c.a&&(b=c.a);}if(!b)throw Error("Invalid additional user info!");if("anonymous"==b||"custom"==b)b=null;c=!1;"undefined"!==typeof a.isNewUser?c=!!a.isNewUser:"identitytoolkit#SignupNewUserResponse"===a.kind&&(c=!0);K(this,"providerId",b);K(this,"isNewUser",c);}function fg(a){hg.call(this,a);a=Me(a.rawUserInfo||"{}");K(this,"profile",cf(a||{}));}v(fg,hg);
  function ag(a){fg.call(this,a);if("facebook.com"!=this.providerId)throw Error("Invalid provider ID!");}v(ag,fg);function cg(a){fg.call(this,a);if("github.com"!=this.providerId)throw Error("Invalid provider ID!");K(this,"username",this.profile&&this.profile.login||null);}v(cg,fg);function bg(a){fg.call(this,a);if("google.com"!=this.providerId)throw Error("Invalid provider ID!");}v(bg,fg);
  function dg(a){fg.call(this,a);if("twitter.com"!=this.providerId)throw Error("Invalid provider ID!");K(this,"username",a.screenName||null);}v(dg,fg);function ig(a){var b=Ld(a),c=Kd(b,"link"),d=Kd(Ld(c),"link");b=Kd(b,"deep_link_id");return Kd(Ld(b),"link")||b||d||c||a}function jg(){}function kg(a,b){return a.then(function(c){if(c[lg]){var d=Rf(c[lg]);if(!d||b!=d.f)throw new M("user-mismatch");return c}throw new M("user-mismatch");}).s(function(c){throw c&&c.code&&c.code==nf+"user-not-found"?new M("user-mismatch"):c;})}function mg(a,b){if(b)this.a=b;else throw new M("internal-error","failed to construct a credential");K(this,"providerId",a);K(this,"signInMethod",a);}mg.prototype.na=function(a){return ng(a,og(this))};
  mg.prototype.b=function(a,b){var c=og(this);c.idToken=b;return pg(a,c)};mg.prototype.f=function(a,b){return kg(qg(a,og(this)),b)};function og(a){return {pendingToken:a.a,requestUri:"http://localhost"}}mg.prototype.A=function(){return {providerId:this.providerId,signInMethod:this.signInMethod,pendingToken:this.a}};function rg(a){if(a&&a.providerId&&a.signInMethod&&0==a.providerId.indexOf("saml.")&&a.pendingToken)try{return new mg(a.providerId,a.pendingToken)}catch(b){}return null}
  function sg(a,b,c){this.a=null;if(b.idToken||b.accessToken)b.idToken&&K(this,"idToken",b.idToken),b.accessToken&&K(this,"accessToken",b.accessToken),b.nonce&&!b.pendingToken&&K(this,"nonce",b.nonce),b.pendingToken&&(this.a=b.pendingToken);else if(b.oauthToken&&b.oauthTokenSecret)K(this,"accessToken",b.oauthToken),K(this,"secret",b.oauthTokenSecret);else throw new M("internal-error","failed to construct a credential");K(this,"providerId",a);K(this,"signInMethod",c);}
  sg.prototype.na=function(a){return ng(a,tg(this))};sg.prototype.b=function(a,b){var c=tg(this);c.idToken=b;return pg(a,c)};sg.prototype.f=function(a,b){var c=tg(this);return kg(qg(a,c),b)};
  function tg(a){var b={};a.idToken&&(b.id_token=a.idToken);a.accessToken&&(b.access_token=a.accessToken);a.secret&&(b.oauth_token_secret=a.secret);b.providerId=a.providerId;a.nonce&&!a.a&&(b.nonce=a.nonce);b={postBody:Pd(b).toString(),requestUri:"http://localhost"};a.a&&(delete b.postBody,b.pendingToken=a.a);return b}
  sg.prototype.A=function(){var a={providerId:this.providerId,signInMethod:this.signInMethod};this.idToken&&(a.oauthIdToken=this.idToken);this.accessToken&&(a.oauthAccessToken=this.accessToken);this.secret&&(a.oauthTokenSecret=this.secret);this.nonce&&(a.nonce=this.nonce);this.a&&(a.pendingToken=this.a);return a};
  function ug(a){if(a&&a.providerId&&a.signInMethod){var b={idToken:a.oauthIdToken,accessToken:a.oauthTokenSecret?null:a.oauthAccessToken,oauthTokenSecret:a.oauthTokenSecret,oauthToken:a.oauthTokenSecret&&a.oauthAccessToken,nonce:a.nonce,pendingToken:a.pendingToken};try{return new sg(a.providerId,b,a.signInMethod)}catch(c){}}return null}function vg(a,b){this.Fc=b||[];L(this,{providerId:a,isOAuthProvider:!0});this.zb={};this.eb=(Zf(a)||{}).Ea||null;this.bb=null;}
  vg.prototype.Ga=function(a){this.zb=Ua(a);return this};function wg(a){if("string"!==typeof a||0!=a.indexOf("saml."))throw new M("argument-error",'SAML provider IDs must be prefixed with "saml."');vg.call(this,a,[]);}v(wg,vg);function O(a){vg.call(this,a,Xf);this.a=[];}v(O,vg);O.prototype.ya=function(a){Na(this.a,a)||this.a.push(a);return this};O.prototype.Hb=function(){return Ra(this.a)};
  O.prototype.credential=function(a,b){var c;r(a)?c={idToken:a.idToken||null,accessToken:a.accessToken||null,nonce:a.rawNonce||null}:c={idToken:a||null,accessToken:b||null};if(!c.idToken&&!c.accessToken)throw new M("argument-error","credential failed: must provide the ID token and/or the access token.");return new sg(this.providerId,c,this.providerId)};function xg(){O.call(this,"facebook.com");}v(xg,O);K(xg,"PROVIDER_ID","facebook.com");K(xg,"FACEBOOK_SIGN_IN_METHOD","facebook.com");
  function yg(a){if(!a)throw new M("argument-error","credential failed: expected 1 argument (the OAuth access token).");var b=a;r(a)&&(b=a.accessToken);return (new xg).credential({accessToken:b})}function zg(){O.call(this,"github.com");}v(zg,O);K(zg,"PROVIDER_ID","github.com");K(zg,"GITHUB_SIGN_IN_METHOD","github.com");
  function Ag(a){if(!a)throw new M("argument-error","credential failed: expected 1 argument (the OAuth access token).");var b=a;r(a)&&(b=a.accessToken);return (new zg).credential({accessToken:b})}function Bg(){O.call(this,"google.com");this.ya("profile");}v(Bg,O);K(Bg,"PROVIDER_ID","google.com");K(Bg,"GOOGLE_SIGN_IN_METHOD","google.com");function Cg(a,b){var c=a;r(a)&&(c=a.idToken,b=a.accessToken);return (new Bg).credential({idToken:c,accessToken:b})}function Dg(){vg.call(this,"twitter.com",Wf);}v(Dg,vg);
  K(Dg,"PROVIDER_ID","twitter.com");K(Dg,"TWITTER_SIGN_IN_METHOD","twitter.com");function Eg(a,b){var c=a;r(c)||(c={oauthToken:a,oauthTokenSecret:b});if(!c.oauthToken||!c.oauthTokenSecret)throw new M("argument-error","credential failed: expected 2 arguments (the OAuth access token and secret).");return new sg("twitter.com",c,"twitter.com")}
  function Fg(a,b,c){this.a=a;this.c=b;K(this,"providerId","password");K(this,"signInMethod",c===Gg.EMAIL_LINK_SIGN_IN_METHOD?Gg.EMAIL_LINK_SIGN_IN_METHOD:Gg.EMAIL_PASSWORD_SIGN_IN_METHOD);}Fg.prototype.na=function(a){return this.signInMethod==Gg.EMAIL_LINK_SIGN_IN_METHOD?P(a,Hg,{email:this.a,oobCode:this.c}):P(a,Ig,{email:this.a,password:this.c})};
  Fg.prototype.b=function(a,b){return this.signInMethod==Gg.EMAIL_LINK_SIGN_IN_METHOD?P(a,Jg,{idToken:b,email:this.a,oobCode:this.c}):P(a,Kg,{idToken:b,email:this.a,password:this.c})};Fg.prototype.f=function(a,b){return kg(this.na(a),b)};Fg.prototype.A=function(){return {email:this.a,password:this.c,signInMethod:this.signInMethod}};function Lg(a){return a&&a.email&&a.password?new Fg(a.email,a.password,a.signInMethod):null}function Gg(){L(this,{providerId:"password",isOAuthProvider:!1});}
  function Mg(a,b){b=Ng(b);if(!b)throw new M("argument-error","Invalid email link!");return new Fg(a,b.code,Gg.EMAIL_LINK_SIGN_IN_METHOD)}function Ng(a){a=ig(a);return (a=yf(a))&&a.operation===hf?a:null}L(Gg,{PROVIDER_ID:"password"});L(Gg,{EMAIL_LINK_SIGN_IN_METHOD:"emailLink"});L(Gg,{EMAIL_PASSWORD_SIGN_IN_METHOD:"password"});function Og(a){if(!(a.Va&&a.Ua||a.Ha&&a.ba))throw new M("internal-error");this.a=a;K(this,"providerId","phone");K(this,"signInMethod","phone");}Og.prototype.na=function(a){return a.Wa(Pg(this))};
  Og.prototype.b=function(a,b){var c=Pg(this);c.idToken=b;return P(a,Qg,c)};Og.prototype.f=function(a,b){var c=Pg(this);c.operation="REAUTH";a=P(a,Rg,c);return kg(a,b)};Og.prototype.A=function(){var a={providerId:"phone"};this.a.Va&&(a.verificationId=this.a.Va);this.a.Ua&&(a.verificationCode=this.a.Ua);this.a.Ha&&(a.temporaryProof=this.a.Ha);this.a.ba&&(a.phoneNumber=this.a.ba);return a};
  function Sg(a){if(a&&"phone"===a.providerId&&(a.verificationId&&a.verificationCode||a.temporaryProof&&a.phoneNumber)){var b={};x(["verificationId","verificationCode","temporaryProof","phoneNumber"],function(c){a[c]&&(b[c]=a[c]);});return new Og(b)}return null}function Pg(a){return a.a.Ha&&a.a.ba?{temporaryProof:a.a.Ha,phoneNumber:a.a.ba}:{sessionInfo:a.a.Va,code:a.a.Ua}}
  function Tg(a){try{this.a=a||firebase.auth();}catch(b){throw new M("argument-error","Either an instance of firebase.auth.Auth must be passed as an argument to the firebase.auth.PhoneAuthProvider constructor, or the default firebase App instance must be initialized via firebase.initializeApp().");}L(this,{providerId:"phone",isOAuthProvider:!1});}
  Tg.prototype.Wa=function(a,b){var c=this.a.b;return D(b.verify()).then(function(d){if(!n(d))throw new M("argument-error","An implementation of firebase.auth.ApplicationVerifier.prototype.verify() must return a firebase.Promise that resolves with a string.");switch(b.type){case "recaptcha":return Ug(c,{phoneNumber:a,recaptchaToken:d}).then(function(e){"function"===typeof b.reset&&b.reset();return e},function(e){"function"===typeof b.reset&&b.reset();throw e;});default:throw new M("argument-error",
  'Only firebase.auth.ApplicationVerifiers with type="recaptcha" are currently supported.');}})};function Vg(a,b){if(!a)throw new M("missing-verification-id");if(!b)throw new M("missing-verification-code");return new Og({Va:a,Ua:b})}L(Tg,{PROVIDER_ID:"phone"});L(Tg,{PHONE_SIGN_IN_METHOD:"phone"});
  function Wg(a){if(a.temporaryProof&&a.phoneNumber)return new Og({Ha:a.temporaryProof,ba:a.phoneNumber});var b=a&&a.providerId;if(!b||"password"===b)return null;var c=a&&a.oauthAccessToken,d=a&&a.oauthTokenSecret,e=a&&a.nonce,f=a&&a.oauthIdToken,g=a&&a.pendingToken;try{switch(b){case "google.com":return Cg(f,c);case "facebook.com":return yg(c);case "github.com":return Ag(c);case "twitter.com":return Eg(c,d);default:return c||d||f||g?g?0==b.indexOf("saml.")?new mg(b,g):new sg(b,{pendingToken:g,idToken:a.oauthIdToken,
  accessToken:a.oauthAccessToken},b):(new O(b)).credential({idToken:f,accessToken:c,rawNonce:e}):null}}catch(h){return null}}function Xg(a){if(!a.isOAuthProvider)throw new M("invalid-oauth-provider");}function Yg(a,b,c,d,e,f,g){this.c=a;this.b=b||null;this.g=c||null;this.f=d||null;this.i=f||null;this.h=g||null;this.a=e||null;if(this.g||this.a){if(this.g&&this.a)throw new M("invalid-auth-event");if(this.g&&!this.f)throw new M("invalid-auth-event");}else throw new M("invalid-auth-event");}Yg.prototype.getUid=function(){var a=[];a.push(this.c);this.b&&a.push(this.b);this.f&&a.push(this.f);this.h&&a.push(this.h);return a.join("-")};Yg.prototype.R=function(){return this.h};
  Yg.prototype.A=function(){return {type:this.c,eventId:this.b,urlResponse:this.g,sessionId:this.f,postBody:this.i,tenantId:this.h,error:this.a&&this.a.A()}};function Zg(a){a=a||{};return a.type?new Yg(a.type,a.eventId,a.urlResponse,a.sessionId,a.error&&pf(a.error),a.postBody,a.tenantId):null}function $g(){this.b=null;this.a=[];}var ah=null;function bh(a){var b=ah;b.a.push(a);b.b||(b.b=function(c){for(var d=0;d<b.a.length;d++)b.a[d](c);},a=J("universalLinks.subscribe",l),"function"===typeof a&&a(null,b.b));}function ch(a){var b="unauthorized-domain",c=void 0,d=Ld(a);a=d.b;d=d.f;"chrome-extension"==d?c=Hb("This chrome extension ID (chrome-extension://%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):"http"==d||"https"==d?c=Hb("This domain (%s) is not authorized to run this operation. Add it to the OAuth redirect domains list in the Firebase console -> Auth section -> Sign in method tab.",a):b="operation-not-supported-in-this-environment";
  M.call(this,b,c);}v(ch,M);function dh(a,b,c){M.call(this,a,c);a=b||{};a.Ab&&K(this,"email",a.Ab);a.ba&&K(this,"phoneNumber",a.ba);a.credential&&K(this,"credential",a.credential);a.Qb&&K(this,"tenantId",a.Qb);}v(dh,M);dh.prototype.A=function(){var a={code:this.code,message:this.message};this.email&&(a.email=this.email);this.phoneNumber&&(a.phoneNumber=this.phoneNumber);this.tenantId&&(a.tenantId=this.tenantId);var b=this.credential&&this.credential.A();b&&Wa(a,b);return a};dh.prototype.toJSON=function(){return this.A()};
  function eh(a){if(a.code){var b=a.code||"";0==b.indexOf(nf)&&(b=b.substring(nf.length));var c={credential:Wg(a),Qb:a.tenantId};if(a.email)c.Ab=a.email;else if(a.phoneNumber)c.ba=a.phoneNumber;else if(!c.credential)return new M(b,a.message||void 0);return new dh(b,c,a.message)}return null}function fh(){}fh.prototype.c=null;function gh(a){return a.c||(a.c=a.b())}var hh;function ih(){}v(ih,fh);ih.prototype.a=function(){var a=jh(this);return a?new ActiveXObject(a):new XMLHttpRequest};ih.prototype.b=function(){var a={};jh(this)&&(a[0]=!0,a[1]=!0);return a};
  function jh(a){if(!a.f&&"undefined"==typeof XMLHttpRequest&&"undefined"!=typeof ActiveXObject){for(var b=["MSXML2.XMLHTTP.6.0","MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"],c=0;c<b.length;c++){var d=b[c];try{return new ActiveXObject(d),a.f=d}catch(e){}}throw Error("Could not create ActiveXObject. ActiveX might be disabled, or MSXML might not be installed");}return a.f}hh=new ih;function kh(){}v(kh,fh);kh.prototype.a=function(){var a=new XMLHttpRequest;if("withCredentials"in a)return a;if("undefined"!=typeof XDomainRequest)return new lh;throw Error("Unsupported browser");};kh.prototype.b=function(){return {}};
  function lh(){this.a=new XDomainRequest;this.readyState=0;this.onreadystatechange=null;this.responseType=this.responseText=this.response="";this.status=-1;this.statusText="";this.a.onload=t(this.fc,this);this.a.onerror=t(this.Ib,this);this.a.onprogress=t(this.gc,this);this.a.ontimeout=t(this.kc,this);}k=lh.prototype;k.open=function(a,b,c){if(null!=c&&!c)throw Error("Only async requests are supported.");this.a.open(a,b);};
  k.send=function(a){if(a)if("string"==typeof a)this.a.send(a);else throw Error("Only string data is supported");else this.a.send();};k.abort=function(){this.a.abort();};k.setRequestHeader=function(){};k.getResponseHeader=function(a){return "content-type"==a.toLowerCase()?this.a.contentType:""};k.fc=function(){this.status=200;this.response=this.responseText=this.a.responseText;mh(this,4);};k.Ib=function(){this.status=500;this.response=this.responseText="";mh(this,4);};k.kc=function(){this.Ib();};
  k.gc=function(){this.status=200;mh(this,1);};function mh(a,b){a.readyState=b;if(a.onreadystatechange)a.onreadystatechange();}k.getAllResponseHeaders=function(){return "content-type: "+this.a.contentType};function nh(a,b,c){this.reset(a,b,c,void 0,void 0);}nh.prototype.a=null;nh.prototype.reset=function(a,b,c,d,e){delete this.a;};function ph(a){this.f=a;this.b=this.c=this.a=null;}function qh(a,b){this.name=a;this.value=b;}qh.prototype.toString=function(){return this.name};var rh=new qh("SEVERE",1E3),sh=new qh("WARNING",900),th=new qh("CONFIG",700),uh=new qh("FINE",500);function vh(a){if(a.c)return a.c;if(a.a)return vh(a.a);ya("Root logger has no level set.");return null}ph.prototype.log=function(a,b,c){if(a.value>=vh(this).value)for(q(b)&&(b=b()),a=new nh(a,String(b),this.f),c&&(a.a=c),c=this;c;)c=c.a;};var wh={},xh=null;
  function yh(a){xh||(xh=new ph(""),wh[""]=xh,xh.c=th);var b;if(!(b=wh[a])){b=new ph(a);var c=a.lastIndexOf("."),d=a.substr(c+1);c=yh(a.substr(0,c));c.b||(c.b={});c.b[d]=b;b.a=c;wh[a]=b;}return b}function zh(a,b){a&&a.log(uh,b,void 0);}function Ah(a){this.f=a;}v(Ah,fh);Ah.prototype.a=function(){return new Bh(this.f)};Ah.prototype.b=function(a){return function(){return a}}({});function Bh(a){G.call(this);this.o=a;this.readyState=Ch;this.status=0;this.responseType=this.responseText=this.response=this.statusText="";this.onreadystatechange=null;this.i=new Headers;this.b=null;this.m="GET";this.g="";this.a=!1;this.h=yh("goog.net.FetchXmlHttp");this.l=this.c=this.f=null;}v(Bh,G);var Ch=0;k=Bh.prototype;
  k.open=function(a,b){if(this.readyState!=Ch)throw this.abort(),Error("Error reopening a connection");this.m=a;this.g=b;this.readyState=1;Dh(this);};k.send=function(a){if(1!=this.readyState)throw this.abort(),Error("need to call open() first. ");this.a=!0;var b={headers:this.i,method:this.m,credentials:void 0,cache:void 0};a&&(b.body=a);this.o.fetch(new Request(this.g,b)).then(this.jc.bind(this),this.Oa.bind(this));};
  k.abort=function(){this.response=this.responseText="";this.i=new Headers;this.status=0;this.c&&this.c.cancel("Request was aborted.");1<=this.readyState&&this.a&&4!=this.readyState&&(this.a=!1,Eh(this,!1));this.readyState=Ch;};
  k.jc=function(a){this.a&&(this.f=a,this.b||(this.b=a.headers,this.readyState=2,Dh(this)),this.a&&(this.readyState=3,Dh(this),this.a&&("arraybuffer"===this.responseType?a.arrayBuffer().then(this.hc.bind(this),this.Oa.bind(this)):"undefined"!==typeof l.ReadableStream&&"body"in a?(this.response=this.responseText="",this.c=a.body.getReader(),this.l=new TextDecoder,Fh(this)):a.text().then(this.ic.bind(this),this.Oa.bind(this)))));};function Fh(a){a.c.read().then(a.ec.bind(a)).catch(a.Oa.bind(a));}
  k.ec=function(a){if(this.a){var b=this.l.decode(a.value?a.value:new Uint8Array(0),{stream:!a.done});b&&(this.response=this.responseText+=b);a.done?Eh(this,!0):Dh(this);3==this.readyState&&Fh(this);}};k.ic=function(a){this.a&&(this.response=this.responseText=a,Eh(this,!0));};k.hc=function(a){this.a&&(this.response=a,Eh(this,!0));};k.Oa=function(a){var b=this.h;b&&b.log(sh,"Failed to fetch url "+this.g,a instanceof Error?a:Error(a));this.a&&Eh(this,!0);};
  function Eh(a,b){b&&a.f&&(a.status=a.f.status,a.statusText=a.f.statusText);a.readyState=4;a.f=null;a.c=null;a.l=null;Dh(a);}k.setRequestHeader=function(a,b){this.i.append(a,b);};k.getResponseHeader=function(a){return this.b?this.b.get(a.toLowerCase())||"":((a=this.h)&&a.log(sh,"Attempting to get response header but no headers have been received for url: "+this.g,void 0),"")};
  k.getAllResponseHeaders=function(){if(!this.b){var a=this.h;a&&a.log(sh,"Attempting to get all response headers but no headers have been received for url: "+this.g,void 0);return ""}a=[];for(var b=this.b.entries(),c=b.next();!c.done;)c=c.value,a.push(c[0]+": "+c[1]),c=b.next();return a.join("\r\n")};function Dh(a){a.onreadystatechange&&a.onreadystatechange.call(a);}function Gh(a){G.call(this);this.headers=new rd;this.B=a||null;this.c=!1;this.w=this.a=null;this.h=this.O=this.l="";this.f=this.J=this.i=this.I=!1;this.g=0;this.o=null;this.m=Hh;this.v=this.P=!1;}v(Gh,G);var Hh="";Gh.prototype.b=yh("goog.net.XhrIo");var Ih=/^https?$/i,Jh=["POST","PUT"];
  function Kh(a,b,c,d,e){if(a.a)throw Error("[goog.net.XhrIo] Object is active with another request="+a.l+"; newUri="+b);c=c?c.toUpperCase():"GET";a.l=b;a.h="";a.O=c;a.I=!1;a.c=!0;a.a=a.B?a.B.a():hh.a();a.w=a.B?gh(a.B):gh(hh);a.a.onreadystatechange=t(a.Lb,a);try{zh(a.b,Lh(a,"Opening Xhr")),a.J=!0,a.a.open(c,String(b),!0),a.J=!1;}catch(g){zh(a.b,Lh(a,"Error opening Xhr: "+g.message));Mh(a,g);return}b=d||"";var f=new rd(a.headers);e&&qd(e,function(g,h){f.set(h,g);});e=La(f.X());d=l.FormData&&b instanceof
  l.FormData;!Na(Jh,c)||e||d||f.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");f.forEach(function(g,h){this.a.setRequestHeader(h,g);},a);a.m&&(a.a.responseType=a.m);"withCredentials"in a.a&&a.a.withCredentials!==a.P&&(a.a.withCredentials=a.P);try{Nh(a),0<a.g&&(a.v=Oh(a.a),zh(a.b,Lh(a,"Will abort after "+a.g+"ms if incomplete, xhr2 "+a.v)),a.v?(a.a.timeout=a.g,a.a.ontimeout=t(a.Ia,a)):a.o=md(a.Ia,a.g,a)),zh(a.b,Lh(a,"Sending request")),a.i=!0,a.a.send(b),a.i=!1;}catch(g){zh(a.b,
  Lh(a,"Send error: "+g.message)),Mh(a,g);}}function Oh(a){return uc&&Ec(9)&&"number"==typeof a.timeout&&void 0!==a.ontimeout}function Ma(a){return "content-type"==a.toLowerCase()}k=Gh.prototype;k.Ia=function(){"undefined"!=typeof fa&&this.a&&(this.h="Timed out after "+this.g+"ms, aborting",zh(this.b,Lh(this,this.h)),this.dispatchEvent("timeout"),this.abort(8));};function Mh(a,b){a.c=!1;a.a&&(a.f=!0,a.a.abort(),a.f=!1);a.h=b;Ph(a);Qh(a);}
  function Ph(a){a.I||(a.I=!0,a.dispatchEvent("complete"),a.dispatchEvent("error"));}k.abort=function(){this.a&&this.c&&(zh(this.b,Lh(this,"Aborting")),this.c=!1,this.f=!0,this.a.abort(),this.f=!1,this.dispatchEvent("complete"),this.dispatchEvent("abort"),Qh(this));};k.za=function(){this.a&&(this.c&&(this.c=!1,this.f=!0,this.a.abort(),this.f=!1),Qh(this,!0));Gh.qb.za.call(this);};k.Lb=function(){this.va||(this.J||this.i||this.f?Rh(this):this.yc());};k.yc=function(){Rh(this);};
  function Rh(a){if(a.c&&"undefined"!=typeof fa)if(a.w[1]&&4==Sh(a)&&2==Th(a))zh(a.b,Lh(a,"Local request error detected and ignored"));else if(a.i&&4==Sh(a))md(a.Lb,0,a);else if(a.dispatchEvent("readystatechange"),4==Sh(a)){zh(a.b,Lh(a,"Request complete"));a.c=!1;try{var b=Th(a);a:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var c=!0;break a;default:c=!1;}var d;if(!(d=c)){var e;if(e=0===b){var f=String(a.l).match(ud)[1]||null;if(!f&&l.self&&l.self.location){var g=l.self.location.protocol;
  f=g.substr(0,g.length-1);}e=!Ih.test(f?f.toLowerCase():"");}d=e;}if(d)a.dispatchEvent("complete"),a.dispatchEvent("success");else{try{var h=2<Sh(a)?a.a.statusText:"";}catch(m){zh(a.b,"Can not get status: "+m.message),h="";}a.h=h+" ["+Th(a)+"]";Ph(a);}}finally{Qh(a);}}}function Qh(a,b){if(a.a){Nh(a);var c=a.a,d=a.w[0]?ka:null;a.a=null;a.w=null;b||a.dispatchEvent("ready");try{c.onreadystatechange=d;}catch(e){(a=a.b)&&a.log(rh,"Problem encountered resetting onreadystatechange: "+e.message,void 0);}}}
  function Nh(a){a.a&&a.v&&(a.a.ontimeout=null);a.o&&(l.clearTimeout(a.o),a.o=null);}function Sh(a){return a.a?a.a.readyState:0}function Th(a){try{return 2<Sh(a)?a.a.status:-1}catch(b){return -1}}function Uh(a){try{return a.a?a.a.responseText:""}catch(b){return zh(a.b,"Can not get responseText: "+b.message),""}}
  k.getResponse=function(){try{if(!this.a)return null;if("response"in this.a)return this.a.response;switch(this.m){case Hh:case "text":return this.a.responseText;case "arraybuffer":if("mozResponseArrayBuffer"in this.a)return this.a.mozResponseArrayBuffer}var a=this.b;a&&a.log(rh,"Response type "+this.m+" is not supported on this browser",void 0);return null}catch(b){return zh(this.b,"Can not get response: "+b.message),null}};function Lh(a,b){return b+" ["+a.O+" "+a.l+" "+Th(a)+"]"}function Vh(a){var b=Wh;this.g=[];this.v=b;this.o=a||null;this.f=this.a=!1;this.c=void 0;this.u=this.w=this.i=!1;this.h=0;this.b=null;this.l=0;}Vh.prototype.cancel=function(a){if(this.a)this.c instanceof Vh&&this.c.cancel();else{if(this.b){var b=this.b;delete this.b;a?b.cancel(a):(b.l--,0>=b.l&&b.cancel());}this.v?this.v.call(this.o,this):this.u=!0;this.a||(a=new Xh(this),Yh(this),Zh(this,!1,a));}};Vh.prototype.m=function(a,b){this.i=!1;Zh(this,a,b);};function Zh(a,b,c){a.a=!0;a.c=c;a.f=!b;$h(a);}
  function Yh(a){if(a.a){if(!a.u)throw new ai(a);a.u=!1;}}function bi(a,b){ci(a,null,b,void 0);}function ci(a,b,c,d){a.g.push([b,c,d]);a.a&&$h(a);}Vh.prototype.then=function(a,b,c){var d,e,f=new B(function(g,h){d=g;e=h;});ci(this,d,function(g){g instanceof Xh?f.cancel():e(g);});return f.then(a,b,c)};Vh.prototype.$goog_Thenable=!0;function di(a){return Ka(a.g,function(b){return q(b[1])})}
  function $h(a){if(a.h&&a.a&&di(a)){var b=a.h,c=ei[b];c&&(l.clearTimeout(c.a),delete ei[b]);a.h=0;}a.b&&(a.b.l--,delete a.b);b=a.c;for(var d=c=!1;a.g.length&&!a.i;){var e=a.g.shift(),f=e[0],g=e[1];e=e[2];if(f=a.f?g:f)try{var h=f.call(e||a.o,b);void 0!==h&&(a.f=a.f&&(h==b||h instanceof Error),a.c=b=h);if(va(b)||"function"===typeof l.Promise&&b instanceof l.Promise)d=!0,a.i=!0;}catch(m){b=m,a.f=!0,di(a)||(c=!0);}}a.c=b;d&&(h=t(a.m,a,!0),d=t(a.m,a,!1),b instanceof Vh?(ci(b,h,d),b.w=!0):b.then(h,d));c&&(b=
  new fi(b),ei[b.a]=b,a.h=b.a);}function ai(){w.call(this);}v(ai,w);ai.prototype.message="Deferred has already fired";ai.prototype.name="AlreadyCalledError";function Xh(){w.call(this);}v(Xh,w);Xh.prototype.message="Deferred was canceled";Xh.prototype.name="CanceledError";function fi(a){this.a=l.setTimeout(t(this.c,this),0);this.b=a;}fi.prototype.c=function(){delete ei[this.a];throw this.b;};var ei={};function gi(a){var c=document,d=db(a).toString(),e=document.createElement("SCRIPT"),f={Nb:e,Ia:void 0},g=new Vh(f),h=null,m=5E3;(h=window.setTimeout(function(){hi(e,!0);var p=new ii(ji,"Timeout reached for loading script "+d);Yh(g);Zh(g,!1,p);},m),f.Ia=h);e.onload=e.onreadystatechange=function(){e.readyState&&"loaded"!=e.readyState&&"complete"!=e.readyState||(hi(e,!1,h),Yh(g),Zh(g,!0,null));};e.onerror=function(){hi(e,!0,h);var p=new ii(ki,"Error while loading script "+
  d);Yh(g);Zh(g,!1,p);};f={};Wa(f,{type:"text/javascript",charset:"UTF-8"});Wd(e,f);Gb(e,a);li(c).appendChild(e);return g}function li(a){var b;return (b=(a||document).getElementsByTagName("HEAD"))&&0!=b.length?b[0]:a.documentElement}function Wh(){if(this&&this.Nb){var a=this.Nb;a&&"SCRIPT"==a.tagName&&hi(a,!0,this.Ia);}}
  function hi(a,b,c){null!=c&&l.clearTimeout(c);a.onload=ka;a.onerror=ka;a.onreadystatechange=ka;b&&window.setTimeout(function(){a&&a.parentNode&&a.parentNode.removeChild(a);},0);}var ki=0,ji=1;function ii(a,b){var c="Jsloader error (code #"+a+")";b&&(c+=": "+b);w.call(this,c);this.code=a;}v(ii,w);function mi(a){this.f=a;}v(mi,fh);mi.prototype.a=function(){return new this.f};mi.prototype.b=function(){return {}};
  function ni(a,b,c){this.c=a;a=b||{};this.l=a.secureTokenEndpoint||"https://securetoken.googleapis.com/v1/token";this.u=a.secureTokenTimeout||oi;this.g=Ua(a.secureTokenHeaders||pi);this.h=a.firebaseEndpoint||"https://www.googleapis.com/identitytoolkit/v3/relyingparty/";this.i=a.firebaseTimeout||qi;this.a=Ua(a.firebaseHeaders||ri);c&&(this.a["X-Client-Version"]=c,this.g["X-Client-Version"]=c);c="Node"==Ae();c=l.XMLHttpRequest||c&&firebase.INTERNAL.node&&firebase.INTERNAL.node.XMLHttpRequest;if(!c&&
  !ze())throw new M("internal-error","The XMLHttpRequest compatibility library was not found.");this.f=void 0;ze()?this.f=new Ah(self):Be()?this.f=new mi(c):this.f=new kh;this.b=null;}var si,lg="idToken",oi=new Pe(3E4,6E4),pi={"Content-Type":"application/x-www-form-urlencoded"},qi=new Pe(3E4,6E4),ri={"Content-Type":"application/json"};function ti(a,b){b?a.a["X-Firebase-Locale"]=b:delete a.a["X-Firebase-Locale"];}
  function ui(a,b){b?(a.a["X-Client-Version"]=b,a.g["X-Client-Version"]=b):(delete a.a["X-Client-Version"],delete a.g["X-Client-Version"]);}ni.prototype.R=function(){return this.b};function vi(a,b,c,d,e,f,g){ke()||ze()?a=t(a.o,a):(si||(si=new B(function(h,m){wi(h,m);})),a=t(a.m,a));a(b,c,d,e,f,g);}
  ni.prototype.o=function(a,b,c,d,e,f){if(ze()&&("undefined"===typeof l.fetch||"undefined"===typeof l.Headers||"undefined"===typeof l.Request))throw new M("operation-not-supported-in-this-environment","fetch, Headers and Request native APIs or equivalent Polyfills must be available to support HTTP requests from a Worker environment.");var g=new Gh(this.f);if(f){g.g=Math.max(0,f);var h=setTimeout(function(){g.dispatchEvent("timeout");},f);}Zc(g,"complete",function(){h&&clearTimeout(h);var m=null;try{m=
  JSON.parse(Uh(this))||null;}catch(p){m=null;}b&&b(m);});ed(g,"ready",function(){h&&clearTimeout(h);pc(this);});ed(g,"timeout",function(){h&&clearTimeout(h);pc(this);b&&b(null);});Kh(g,a,c,d,e);};var xi=new Xa(Ya,"https://apis.google.com/js/client.js?onload=%{onload}"),yi="__fcb"+Math.floor(1E6*Math.random()).toString();
  function wi(a,b){if(((window.gapi||{}).client||{}).request)a();else{l[yi]=function(){((window.gapi||{}).client||{}).request?a():b(Error("CORS_UNSUPPORTED"));};var c=eb(xi,{onload:yi});bi(gi(c),function(){b(Error("CORS_UNSUPPORTED"));});}}
  ni.prototype.m=function(a,b,c,d,e){var f=this;si.then(function(){window.gapi.client.setApiKey(f.c);var g=window.gapi.auth.getToken();window.gapi.auth.setToken(null);window.gapi.client.request({path:a,method:c,body:d,headers:e,authType:"none",callback:function(h){window.gapi.auth.setToken(g);b&&b(h);}});}).s(function(g){b&&b({error:{message:g&&g.message||"CORS_UNSUPPORTED"}});});};
  function zi(a,b){return new B(function(c,d){"refresh_token"==b.grant_type&&b.refresh_token||"authorization_code"==b.grant_type&&b.code?vi(a,a.l+"?key="+encodeURIComponent(a.c),function(e){e?e.error?d(Ai(e)):e.access_token&&e.refresh_token?c(e):d(new M("internal-error")):d(new M("network-request-failed"));},"POST",Pd(b).toString(),a.g,a.u.get()):d(new M("internal-error"));})}
  function Bi(a,b,c,d,e,f){var g=Ld(a.h+b);H(g,"key",a.c);f&&H(g,"cb",ua().toString());var h="GET"==c;if(h)for(var m in d)d.hasOwnProperty(m)&&H(g,m,d[m]);return new B(function(p,u){vi(a,g.toString(),function(A){A?A.error?u(Ai(A,e||{})):p(A):u(new M("network-request-failed"));},c,h?void 0:ae(Le(d)),a.a,a.i.get());})}function Ci(a){a=a.email;if(!n(a)||!te.test(a))throw new M("invalid-email");}function Di(a){"email"in a&&Ci(a);}
  function Ei(a,b){return P(a,Fi,{identifier:b,continueUri:Ie()?he():"http://localhost"}).then(function(c){return c.signinMethods||[]})}function Gi(a){return P(a,Hi,{}).then(function(b){return b.authorizedDomains||[]})}function Ii(a){if(!a[lg])throw new M("internal-error");}
  function Ji(a){if(a.phoneNumber||a.temporaryProof){if(!a.phoneNumber||!a.temporaryProof)throw new M("internal-error");}else{if(!a.sessionInfo)throw new M("missing-verification-id");if(!a.code)throw new M("missing-verification-code");}}ni.prototype.ob=function(){return P(this,Ki,{})};ni.prototype.rb=function(a,b){return P(this,Li,{idToken:a,email:b})};ni.prototype.sb=function(a,b){return P(this,Kg,{idToken:a,password:b})};var Mi={displayName:"DISPLAY_NAME",photoUrl:"PHOTO_URL"};k=ni.prototype;
  k.tb=function(a,b){var c={idToken:a},d=[];Sa(Mi,function(e,f){var g=b[f];null===g?d.push(e):f in b&&(c[f]=g);});d.length&&(c.deleteAttribute=d);return P(this,Li,c)};k.kb=function(a,b){a={requestType:"PASSWORD_RESET",email:a};Wa(a,b);return P(this,Ni,a)};k.lb=function(a,b){a={requestType:"EMAIL_SIGNIN",email:a};Wa(a,b);return P(this,Oi,a)};k.jb=function(a,b){a={requestType:"VERIFY_EMAIL",idToken:a};Wa(a,b);return P(this,Pi,a)};function Ug(a,b){return P(a,Qi,b)}k.Wa=function(a){return P(this,Ri,a)};
  function Si(a,b,c){return P(a,Ti,{idToken:b,deleteProvider:c})}function Ui(a){if(!a.requestUri||!a.sessionId&&!a.postBody&&!a.pendingToken)throw new M("internal-error");}function Vi(a,b){b.oauthIdToken&&b.providerId&&0==b.providerId.indexOf("oidc.")&&!b.pendingToken&&(a.sessionId?b.nonce=a.sessionId:a.postBody&&(a=new Cd(a.postBody),Td(a,"nonce")&&(b.nonce=a.get("nonce"))));return b}
  function Wi(a){var b=null;a.needConfirmation?(a.code="account-exists-with-different-credential",b=eh(a)):"FEDERATED_USER_ID_ALREADY_LINKED"==a.errorMessage?(a.code="credential-already-in-use",b=eh(a)):"EMAIL_EXISTS"==a.errorMessage?(a.code="email-already-in-use",b=eh(a)):a.errorMessage&&(b=Xi(a.errorMessage));if(b)throw b;if(!a[lg])throw new M("internal-error");}function ng(a,b){b.returnIdpCredential=!0;return P(a,Yi,b)}function pg(a,b){b.returnIdpCredential=!0;return P(a,Zi,b)}
  function qg(a,b){b.returnIdpCredential=!0;b.autoCreate=!1;return P(a,$i,b)}function aj(a){if(!a.oobCode)throw new M("invalid-action-code");}k.ab=function(a,b){return P(this,bj,{oobCode:a,newPassword:b})};k.Ma=function(a){return P(this,cj,{oobCode:a})};k.Ya=function(a){return P(this,dj,{oobCode:a})};
  var dj={endpoint:"setAccountInfo",D:aj,fa:"email",F:!0},cj={endpoint:"resetPassword",D:aj,K:function(a){var b=a.requestType;if(!b||!a.email&&"EMAIL_SIGNIN"!=b)throw new M("internal-error");},F:!0},ej={endpoint:"signupNewUser",D:function(a){Ci(a);if(!a.password)throw new M("weak-password");},K:Ii,T:!0,F:!0},Fi={endpoint:"createAuthUri",F:!0},fj={endpoint:"deleteAccount",V:["idToken"]},Ti={endpoint:"setAccountInfo",V:["idToken","deleteProvider"],D:function(a){if(!na(a.deleteProvider))throw new M("internal-error");
  }},Hg={endpoint:"emailLinkSignin",V:["email","oobCode"],D:Ci,K:Ii,T:!0,F:!0},Jg={endpoint:"emailLinkSignin",V:["idToken","email","oobCode"],D:Ci,K:Ii,T:!0},gj={endpoint:"getAccountInfo"},Oi={endpoint:"getOobConfirmationCode",V:["requestType"],D:function(a){if("EMAIL_SIGNIN"!=a.requestType)throw new M("internal-error");Ci(a);},fa:"email",F:!0},Pi={endpoint:"getOobConfirmationCode",V:["idToken","requestType"],D:function(a){if("VERIFY_EMAIL"!=a.requestType)throw new M("internal-error");},fa:"email",F:!0},
  Ni={endpoint:"getOobConfirmationCode",V:["requestType"],D:function(a){if("PASSWORD_RESET"!=a.requestType)throw new M("internal-error");Ci(a);},fa:"email",F:!0},Hi={wb:!0,endpoint:"getProjectConfig",Kb:"GET"},hj={wb:!0,endpoint:"getRecaptchaParam",Kb:"GET",K:function(a){if(!a.recaptchaSiteKey)throw new M("internal-error");}},bj={endpoint:"resetPassword",D:aj,fa:"email",F:!0},Qi={endpoint:"sendVerificationCode",V:["phoneNumber","recaptchaToken"],fa:"sessionInfo",F:!0},Li={endpoint:"setAccountInfo",V:["idToken"],
  D:Di,T:!0},Kg={endpoint:"setAccountInfo",V:["idToken"],D:function(a){Di(a);if(!a.password)throw new M("weak-password");},K:Ii,T:!0},Ki={endpoint:"signupNewUser",K:Ii,T:!0,F:!0},Yi={endpoint:"verifyAssertion",D:Ui,Ra:Vi,K:Wi,T:!0,F:!0},$i={endpoint:"verifyAssertion",D:Ui,Ra:Vi,K:function(a){if(a.errorMessage&&"USER_NOT_FOUND"==a.errorMessage)throw new M("user-not-found");if(a.errorMessage)throw Xi(a.errorMessage);if(!a[lg])throw new M("internal-error");},T:!0,F:!0},Zi={endpoint:"verifyAssertion",D:function(a){Ui(a);
  if(!a.idToken)throw new M("internal-error");},Ra:Vi,K:Wi,T:!0},ij={endpoint:"verifyCustomToken",D:function(a){if(!a.token)throw new M("invalid-custom-token");},K:Ii,T:!0,F:!0},Ig={endpoint:"verifyPassword",D:function(a){Ci(a);if(!a.password)throw new M("wrong-password");},K:Ii,T:!0,F:!0},Ri={endpoint:"verifyPhoneNumber",D:Ji,K:Ii,F:!0},Qg={endpoint:"verifyPhoneNumber",D:function(a){if(!a.idToken)throw new M("internal-error");Ji(a);},K:function(a){if(a.temporaryProof)throw a.code="credential-already-in-use",
  eh(a);Ii(a);}},Rg={Yb:{USER_NOT_FOUND:"user-not-found"},endpoint:"verifyPhoneNumber",D:Ji,K:Ii,F:!0};
  function P(a,b,c){if(!bf(c,b.V))return E(new M("internal-error"));var d=b.Kb||"POST",e;return D(c).then(b.D).then(function(){b.T&&(c.returnSecureToken=!0);b.F&&a.b&&"undefined"===typeof c.tenantId&&(c.tenantId=a.b);return Bi(a,b.endpoint,d,c,b.Yb,b.wb||!1)}).then(function(f){e=f;return b.Ra?b.Ra(c,e):e}).then(b.K).then(function(){if(!b.fa)return e;if(!(b.fa in e))throw new M("internal-error");return e[b.fa]})}function Xi(a){return Ai({error:{errors:[{message:a}],code:400,message:a}})}
  function Ai(a,b){var c=(a.error&&a.error.errors&&a.error.errors[0]||{}).reason||"";var d={keyInvalid:"invalid-api-key",ipRefererBlocked:"app-not-authorized"};if(c=d[c]?new M(d[c]):null)return c;c=a.error&&a.error.message||"";d={INVALID_CUSTOM_TOKEN:"invalid-custom-token",CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_EMAIL:"invalid-email",INVALID_PASSWORD:"wrong-password",USER_DISABLED:"user-disabled",
  MISSING_PASSWORD:"internal-error",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_OR_INVALID_NONCE:"missing-or-invalid-nonce",INVALID_MESSAGE_PAYLOAD:"invalid-message-payload",INVALID_RECIPIENT_EMAIL:"invalid-recipient-email",INVALID_SENDER:"invalid-sender",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",
  EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",INVALID_PROVIDER_ID:"invalid-provider-id",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",CORS_UNSUPPORTED:"cors-unsupported",DYNAMIC_LINK_NOT_ACTIVATED:"dynamic-link-not-activated",INVALID_APP_ID:"invalid-app-id",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",WEAK_PASSWORD:"weak-password",
  OPERATION_NOT_ALLOWED:"operation-not-allowed",USER_CANCELLED:"user-cancelled",CAPTCHA_CHECK_FAILED:"captcha-check-failed",INVALID_APP_CREDENTIAL:"invalid-app-credential",INVALID_CODE:"invalid-verification-code",INVALID_PHONE_NUMBER:"invalid-phone-number",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_APP_CREDENTIAL:"missing-app-credential",MISSING_CODE:"missing-verification-code",MISSING_PHONE_NUMBER:"missing-phone-number",MISSING_SESSION_INFO:"missing-verification-id",
  QUOTA_EXCEEDED:"quota-exceeded",SESSION_EXPIRED:"code-expired",REJECTED_CREDENTIAL:"rejected-credential",INVALID_CONTINUE_URI:"invalid-continue-uri",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",MISSING_IOS_BUNDLE_ID:"missing-ios-bundle-id",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_DYNAMIC_LINK_DOMAIN:"invalid-dynamic-link-domain",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",INVALID_CERT_HASH:"invalid-cert-hash",UNSUPPORTED_TENANT_OPERATION:"unsupported-tenant-operation",
  INVALID_TENANT_ID:"invalid-tenant-id",TENANT_ID_MISMATCH:"tenant-id-mismatch",ADMIN_ONLY_OPERATION:"admin-restricted-operation"};Wa(d,b||{});b=(b=c.match(/^[^\s]+\s*:\s*([\s\S]*)$/))&&1<b.length?b[1]:void 0;for(var e in d)if(0===c.indexOf(e))return new M(d[e],b);!b&&a&&(b=Ke(a));return new M("internal-error",b)}function jj(a){this.b=a;this.a=null;this.gb=kj(this);}
  function kj(a){return lj().then(function(){return new B(function(b,c){J("gapi.iframes.getContext")().open({where:document.body,url:a.b,messageHandlersFilter:J("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"),attributes:{style:{position:"absolute",top:"-100px",width:"1px",height:"1px"}},dontclear:!0},function(d){function e(){clearTimeout(f);b();}a.a=d;a.a.restyle({setHideOnLeave:!1});var f=setTimeout(function(){c(Error("Network Error"));},mj.get());d.ping(e).then(e,function(){c(Error("Network Error"));});});})})}
  function nj(a,b){return a.gb.then(function(){return new B(function(c){a.a.send(b.type,b,c,J("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"));})})}function oj(a,b){a.gb.then(function(){a.a.register("authEvent",b,J("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"));});}var pj=new Xa(Ya,"https://apis.google.com/js/api.js?onload=%{onload}"),qj=new Pe(3E4,6E4),mj=new Pe(5E3,15E3),rj=null;
  function lj(){return rj?rj:rj=(new B(function(a,b){function c(){Oe();J("gapi.load")("gapi.iframes",{callback:a,ontimeout:function(){Oe();b(Error("Network Error"));},timeout:qj.get()});}if(J("gapi.iframes.Iframe"))a();else if(J("gapi.load"))c();else{var d="__iframefcb"+Math.floor(1E6*Math.random()).toString();l[d]=function(){J("gapi.load")?c():b(Error("Network Error"));};d=eb(pj,{onload:d});D(gi(d)).s(function(){b(Error("Network Error"));});}})).s(function(a){rj=null;throw a;})}function sj(a,b,c){this.i=a;this.g=b;this.h=c;this.f=null;this.a=Md(this.i,"/__/auth/iframe");H(this.a,"apiKey",this.g);H(this.a,"appName",this.h);this.b=null;this.c=[];}sj.prototype.toString=function(){this.f?H(this.a,"v",this.f):Sd(this.a.a,"v");this.b?H(this.a,"eid",this.b):Sd(this.a.a,"eid");this.c.length?H(this.a,"fw",this.c.join(",")):Sd(this.a.a,"fw");return this.a.toString()};function tj(a,b,c,d,e){this.o=a;this.m=b;this.c=c;this.u=d;this.i=this.g=this.l=null;this.a=e;this.h=this.f=null;}
  tj.prototype.nb=function(a){this.h=a;return this};
  tj.prototype.toString=function(){var a=Md(this.o,"/__/auth/handler");H(a,"apiKey",this.m);H(a,"appName",this.c);H(a,"authType",this.u);if(this.a.isOAuthProvider){var b=this.a;try{var c=firebase.app(this.c).auth().ha();}catch(h){c=null;}b.bb=c;H(a,"providerId",this.a.providerId);b=this.a;c=Le(b.zb);for(var d in c)c[d]=c[d].toString();d=b.Fc;c=Ua(c);for(var e=0;e<d.length;e++){var f=d[e];f in c&&delete c[f];}b.eb&&b.bb&&!c[b.eb]&&(c[b.eb]=b.bb);Ta(c)||H(a,"customParameters",Ke(c));}"function"===typeof this.a.Hb&&
  (b=this.a.Hb(),b.length&&H(a,"scopes",b.join(",")));this.l?H(a,"redirectUrl",this.l):Sd(a.a,"redirectUrl");this.g?H(a,"eventId",this.g):Sd(a.a,"eventId");this.i?H(a,"v",this.i):Sd(a.a,"v");if(this.b)for(var g in this.b)this.b.hasOwnProperty(g)&&!Kd(a,g)&&H(a,g,this.b[g]);this.h?H(a,"tid",this.h):Sd(a.a,"tid");this.f?H(a,"eid",this.f):Sd(a.a,"eid");g=uj(this.c);g.length&&H(a,"fw",g.join(","));return a.toString()};function uj(a){try{return firebase.app(a).auth().Ca()}catch(b){return []}}
  function vj(a,b,c,d,e){this.u=a;this.f=b;this.b=c;this.c=d||null;this.h=e||null;this.m=this.o=this.v=null;this.g=[];this.l=this.a=null;}
  function wj(a){var b=he();return Gi(a).then(function(c){a:{var d=Ld(b),e=d.f;d=d.b;for(var f=0;f<c.length;f++){var g=c[f];var h=d;var m=e;0==g.indexOf("chrome-extension://")?h=Ld(g).b==h&&"chrome-extension"==m:"http"!=m&&"https"!=m?h=!1:se.test(g)?h=h==g:(g=g.split(".").join("\\."),h=(new RegExp("^(.+\\."+g+"|"+g+")$","i")).test(h));if(h){c=!0;break a}}c=!1;}if(!c)throw new ch(he());})}
  function xj(a){if(a.l)return a.l;a.l=ue().then(function(){if(!a.o){var b=a.c,c=a.h,d=uj(a.b),e=new sj(a.u,a.f,a.b);e.f=b;e.b=c;e.c=Ra(d||[]);a.o=e.toString();}a.i=new jj(a.o);yj(a);});return a.l}k=vj.prototype;k.Fb=function(a,b,c){var d=new M("popup-closed-by-user"),e=new M("web-storage-unsupported"),f=this,g=!1;return this.ia().then(function(){zj(f).then(function(h){h||(a&&oe(a),b(e),g=!0);});}).s(function(){}).then(function(){if(!g)return re(a)}).then(function(){if(!g)return nd(c).then(function(){b(d);})})};
  k.Ob=function(){var a=I();return !Je(a)&&!Ne(a)};k.Jb=function(){return !1};
  k.Db=function(a,b,c,d,e,f,g,h){if(!a)return E(new M("popup-blocked"));if(g&&!Je())return this.ia().s(function(p){oe(a);e(p);}),d(),D();this.a||(this.a=wj(Aj(this)));var m=this;return this.a.then(function(){var p=m.ia().s(function(u){oe(a);e(u);throw u;});d();return p}).then(function(){Xg(c);if(!g){var p=Bj(m.u,m.f,m.b,b,c,null,f,m.c,void 0,m.h,h);ie(p,a);}}).s(function(p){"auth/network-request-failed"==p.code&&(m.a=null);throw p;})};
  function Aj(a){a.m||(a.v=a.c?Ee(a.c,uj(a.b)):null,a.m=new ni(a.f,Uf(a.h),a.v));return a.m}k.Eb=function(a,b,c,d){this.a||(this.a=wj(Aj(this)));var e=this;return this.a.then(function(){Xg(b);var f=Bj(e.u,e.f,e.b,a,b,he(),c,e.c,void 0,e.h,d);ie(f);}).s(function(f){"auth/network-request-failed"==f.code&&(e.a=null);throw f;})};k.ia=function(){var a=this;return xj(this).then(function(){return a.i.gb}).s(function(){a.a=null;throw new M("network-request-failed");})};k.Rb=function(){return !0};
  function Bj(a,b,c,d,e,f,g,h,m,p,u){a=new tj(a,b,c,d,e);a.l=f;a.g=g;a.i=h;a.b=Ua(m||null);a.f=p;return a.nb(u).toString()}function yj(a){if(!a.i)throw Error("IfcHandler must be initialized!");oj(a.i,function(b){var c={};if(b&&b.authEvent){var d=!1;b=Zg(b.authEvent);for(c=0;c<a.g.length;c++)d=a.g[c](b)||d;c={};c.status=d?"ACK":"ERROR";return D(c)}c.status="ERROR";return D(c)});}
  function zj(a){var b={type:"webStorageSupport"};return xj(a).then(function(){return nj(a.i,b)}).then(function(c){if(c&&c.length&&"undefined"!==typeof c[0].webStorageSupport)return c[0].webStorageSupport;throw Error();})}k.Aa=function(a){this.g.push(a);};k.Na=function(a){Pa(this.g,function(b){return b==a});};function Cj(a){this.a=a||firebase.INTERNAL.reactNative&&firebase.INTERNAL.reactNative.AsyncStorage;if(!this.a)throw new M("internal-error","The React Native compatibility library was not found.");this.type="asyncStorage";}k=Cj.prototype;k.get=function(a){return D(this.a.getItem(a)).then(function(b){return b&&Me(b)})};k.set=function(a,b){return D(this.a.setItem(a,Ke(b)))};k.S=function(a){return D(this.a.removeItem(a))};k.$=function(){};k.ea=function(){};function Dj(a){this.b=a;this.a={};this.f=t(this.c,this);}var Ej=[];function Fj(){var a=ze()?self:null;x(Ej,function(c){c.b==a&&(b=c);});if(!b){var b=new Dj(a);Ej.push(b);}return b}
  Dj.prototype.c=function(a){var b=a.data.eventType,c=a.data.eventId,d=this.a[b];if(d&&0<d.length){a.ports[0].postMessage({status:"ack",eventId:c,eventType:b,response:null});var e=[];x(d,function(f){e.push(D().then(function(){return f(a.origin,a.data.data)}));});bc(e).then(function(f){var g=[];x(f,function(h){g.push({fulfilled:h.Gb,value:h.value,reason:h.reason?h.reason.message:void 0});});x(g,function(h){for(var m in h)"undefined"===typeof h[m]&&delete h[m];});a.ports[0].postMessage({status:"done",eventId:c,
  eventType:b,response:g});});}};function Gj(a,b,c){Ta(a.a)&&a.b.addEventListener("message",a.f);"undefined"===typeof a.a[b]&&(a.a[b]=[]);a.a[b].push(c);}function Hj(a){this.a=a;}Hj.prototype.postMessage=function(a,b){this.a.postMessage(a,b);};function Ij(a){this.c=a;this.b=!1;this.a=[];}
  function Jj(a,b,c,d){var e,f=c||{},g,h,m,p=null;if(a.b)return E(Error("connection_unavailable"));var u=d?800:50,A="undefined"!==typeof MessageChannel?new MessageChannel:null;return (new B(function(C,N){A?(e=Math.floor(Math.random()*Math.pow(10,20)).toString(),A.port1.start(),h=setTimeout(function(){N(Error("unsupported_event"));},u),g=function(wa){wa.data.eventId===e&&("ack"===wa.data.status?(clearTimeout(h),m=setTimeout(function(){N(Error("timeout"));},3E3)):"done"===wa.data.status?(clearTimeout(m),
  "undefined"!==typeof wa.data.response?C(wa.data.response):N(Error("unknown_error"))):(clearTimeout(h),clearTimeout(m),N(Error("invalid_response"))));},p={messageChannel:A,onMessage:g},a.a.push(p),A.port1.addEventListener("message",g),a.c.postMessage({eventType:b,eventId:e,data:f},[A.port2])):N(Error("connection_unavailable"));})).then(function(C){Kj(a,p);return C}).s(function(C){Kj(a,p);throw C;})}
  function Kj(a,b){if(b){var c=b.messageChannel,d=b.onMessage;c&&(c.port1.removeEventListener("message",d),c.port1.close());Pa(a.a,function(e){return e==b});}}Ij.prototype.close=function(){for(;0<this.a.length;)Kj(this,this.a[0]);this.b=!0;};function Lj(){if(!Mj())throw new M("web-storage-unsupported");this.c={};this.a=[];this.b=0;this.u=l.indexedDB;this.type="indexedDB";this.g=this.l=this.f=this.i=null;this.o=!1;this.h=null;var a=this;ze()&&self?(this.l=Fj(),Gj(this.l,"keyChanged",function(b,c){return Nj(a).then(function(d){0<d.length&&x(a.a,function(e){e(d);});return {keyProcessed:Na(d,c.key)}})}),Gj(this.l,"ping",function(){return D(["keyChanged"])})):Ve().then(function(b){if(a.h=b)a.g=new Ij(new Hj(b)),Jj(a.g,"ping",null,!0).then(function(c){c[0].fulfilled&&
  Na(c[0].value,"keyChanged")&&(a.o=!0);}).s(function(){});});}var Oj;function Pj(a){return new B(function(b,c){var d=a.u.deleteDatabase("firebaseLocalStorageDb");d.onsuccess=function(){b();};d.onerror=function(e){c(Error(e.target.error));};})}
  function Qj(a){return new B(function(b,c){var d=a.u.open("firebaseLocalStorageDb",1);d.onerror=function(e){try{e.preventDefault();}catch(f){}c(Error(e.target.error));};d.onupgradeneeded=function(e){e=e.target.result;try{e.createObjectStore("firebaseLocalStorage",{keyPath:"fbase_key"});}catch(f){c(f);}};d.onsuccess=function(e){e=e.target.result;e.objectStoreNames.contains("firebaseLocalStorage")?b(e):Pj(a).then(function(){return Qj(a)}).then(function(f){b(f);}).s(function(f){c(f);});};})}
  function Rj(a){a.m||(a.m=Qj(a));return a.m}function Mj(){try{return !!l.indexedDB}catch(a){return !1}}function Sj(a){return a.objectStore("firebaseLocalStorage")}function Tj(a,b){return a.transaction(["firebaseLocalStorage"],b?"readwrite":"readonly")}function Uj(a){return new B(function(b,c){a.onsuccess=function(d){d&&d.target?b(d.target.result):b();};a.onerror=function(d){c(d.target.error);};})}k=Lj.prototype;
  k.set=function(a,b){var c=!1,d,e=this;return Rj(this).then(function(f){d=f;f=Sj(Tj(d,!0));return Uj(f.get(a))}).then(function(f){var g=Sj(Tj(d,!0));if(f)return f.value=b,Uj(g.put(f));e.b++;c=!0;f={};f.fbase_key=a;f.value=b;return Uj(g.add(f))}).then(function(){e.c[a]=b;return Vj(e,a)}).ka(function(){c&&e.b--;})};function Vj(a,b){return a.g&&a.h&&Ue()===a.h?Jj(a.g,"keyChanged",{key:b},a.o).then(function(){}).s(function(){}):D()}
  k.get=function(a){return Rj(this).then(function(b){return Uj(Sj(Tj(b,!1)).get(a))}).then(function(b){return b&&b.value})};k.S=function(a){var b=!1,c=this;return Rj(this).then(function(d){b=!0;c.b++;return Uj(Sj(Tj(d,!0))["delete"](a))}).then(function(){delete c.c[a];return Vj(c,a)}).ka(function(){b&&c.b--;})};
  function Nj(a){return Rj(a).then(function(b){var c=Sj(Tj(b,!1));return c.getAll?Uj(c.getAll()):new B(function(d,e){var f=[],g=c.openCursor();g.onsuccess=function(h){(h=h.target.result)?(f.push(h.value),h["continue"]()):d(f);};g.onerror=function(h){e(h.target.error);};})}).then(function(b){var c={},d=[];if(0==a.b){for(d=0;d<b.length;d++)c[b[d].fbase_key]=b[d].value;d=je(a.c,c);a.c=c;}return d})}k.$=function(a){0==this.a.length&&Wj(this);this.a.push(a);};
  k.ea=function(a){Pa(this.a,function(b){return b==a});0==this.a.length&&Xj(this);};function Wj(a){function b(){a.f=setTimeout(function(){a.i=Nj(a).then(function(c){0<c.length&&x(a.a,function(d){d(c);});}).then(function(){b();}).s(function(c){"STOP_EVENT"!=c.message&&b();});},800);}Xj(a);b();}function Xj(a){a.i&&a.i.cancel("STOP_EVENT");a.f&&(clearTimeout(a.f),a.f=null);}function Yj(a){var b=this,c=null;this.a=[];this.type="indexedDB";this.c=a;this.b=D().then(function(){if(Mj()){var d=Ge(),e="__sak"+d;Oj||(Oj=new Lj);c=Oj;return c.set(e,d).then(function(){return c.get(e)}).then(function(f){if(f!==d)throw Error("indexedDB not supported!");return c.S(e)}).then(function(){return c}).s(function(){return b.c})}return b.c}).then(function(d){b.type=d.type;d.$(function(e){x(b.a,function(f){f(e);});});return d});}k=Yj.prototype;k.get=function(a){return this.b.then(function(b){return b.get(a)})};
  k.set=function(a,b){return this.b.then(function(c){return c.set(a,b)})};k.S=function(a){return this.b.then(function(b){return b.S(a)})};k.$=function(a){this.a.push(a);};k.ea=function(a){Pa(this.a,function(b){return b==a});};function Zj(){this.a={};this.type="inMemory";}k=Zj.prototype;k.get=function(a){return D(this.a[a])};k.set=function(a,b){this.a[a]=b;return D()};k.S=function(a){delete this.a[a];return D()};k.$=function(){};k.ea=function(){};function ak(){if(!bk()){if("Node"==Ae())throw new M("internal-error","The LocalStorage compatibility library was not found.");throw new M("web-storage-unsupported");}this.a=ck()||firebase.INTERNAL.node.localStorage;this.type="localStorage";}function ck(){try{var a=l.localStorage,b=Ge();a&&(a.setItem(b,"1"),a.removeItem(b));return a}catch(c){return null}}
  function bk(){var a="Node"==Ae();a=ck()||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.localStorage;if(!a)return !1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return !1}}k=ak.prototype;k.get=function(a){var b=this;return D().then(function(){var c=b.a.getItem(a);return Me(c)})};k.set=function(a,b){var c=this;return D().then(function(){var d=Ke(b);null===d?c.S(a):c.a.setItem(a,d);})};k.S=function(a){var b=this;return D().then(function(){b.a.removeItem(a);})};
  k.$=function(a){l.window&&Wc(l.window,"storage",a);};k.ea=function(a){l.window&&fd(l.window,"storage",a);};function dk(){this.type="nullStorage";}k=dk.prototype;k.get=function(){return D(null)};k.set=function(){return D()};k.S=function(){return D()};k.$=function(){};k.ea=function(){};function ek(){if(!fk()){if("Node"==Ae())throw new M("internal-error","The SessionStorage compatibility library was not found.");throw new M("web-storage-unsupported");}this.a=gk()||firebase.INTERNAL.node.sessionStorage;this.type="sessionStorage";}function gk(){try{var a=l.sessionStorage,b=Ge();a&&(a.setItem(b,"1"),a.removeItem(b));return a}catch(c){return null}}
  function fk(){var a="Node"==Ae();a=gk()||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.sessionStorage;if(!a)return !1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return !1}}k=ek.prototype;k.get=function(a){var b=this;return D().then(function(){var c=b.a.getItem(a);return Me(c)})};k.set=function(a,b){var c=this;return D().then(function(){var d=Ke(b);null===d?c.S(a):c.a.setItem(a,d);})};k.S=function(a){var b=this;return D().then(function(){b.a.removeItem(a);})};k.$=function(){};
  k.ea=function(){};function hk(){var a={};a.Browser=ik;a.Node=jk;a.ReactNative=kk;a.Worker=lk;this.a=a[Ae()];}var mk,ik={C:ak,Ta:ek},jk={C:ak,Ta:ek},kk={C:Cj,Ta:dk},lk={C:ak,Ta:dk};var nk={ad:"local",NONE:"none",cd:"session"};function ok(a){var b=new M("invalid-persistence-type"),c=new M("unsupported-persistence-type");a:{for(d in nk)if(nk[d]==a){var d=!0;break a}d=!1;}if(!d||"string"!==typeof a)throw b;switch(Ae()){case "ReactNative":if("session"===a)throw c;break;case "Node":if("none"!==a)throw c;break;default:if(!Fe()&&"none"!==a)throw c;}}
  function pk(){var a=!Ne(I())&&ye()?!0:!1,b=Je(),c=Fe();this.m=a;this.h=b;this.l=c;this.a={};mk||(mk=new hk);a=mk;try{this.g=!ge()&&Te()||!l.indexedDB?new a.a.C:new Yj(ze()?new Zj:new a.a.C);}catch(d){this.g=new Zj,this.h=!0;}try{this.i=new a.a.Ta;}catch(d){this.i=new Zj;}this.u=new Zj;this.f=t(this.Pb,this);this.b={};}var qk;function rk(){qk||(qk=new pk);return qk}function sk(a,b){switch(b){case "session":return a.i;case "none":return a.u;default:return a.g}}
  function tk(a,b){return "firebase:"+a.name+(b?":"+b:"")}function uk(a,b,c){var d=tk(b,c),e=sk(a,b.C);return a.get(b,c).then(function(f){var g=null;try{g=Me(l.localStorage.getItem(d));}catch(h){}if(g&&!f)return l.localStorage.removeItem(d),a.set(b,g,c);g&&f&&"localStorage"!=e.type&&l.localStorage.removeItem(d);})}k=pk.prototype;k.get=function(a,b){return sk(this,a.C).get(tk(a,b))};function vk(a,b,c){c=tk(b,c);"local"==b.C&&(a.b[c]=null);return sk(a,b.C).S(c)}
  k.set=function(a,b,c){var d=tk(a,c),e=this,f=sk(this,a.C);return f.set(d,b).then(function(){return f.get(d)}).then(function(g){"local"==a.C&&(e.b[d]=g);})};k.addListener=function(a,b,c){a=tk(a,b);this.l&&(this.b[a]=l.localStorage.getItem(a));Ta(this.a)&&(sk(this,"local").$(this.f),this.h||(ge()||!Te())&&l.indexedDB||!this.l||wk(this));this.a[a]||(this.a[a]=[]);this.a[a].push(c);};
  k.removeListener=function(a,b,c){a=tk(a,b);this.a[a]&&(Pa(this.a[a],function(d){return d==c}),0==this.a[a].length&&delete this.a[a]);Ta(this.a)&&(sk(this,"local").ea(this.f),xk(this));};function wk(a){xk(a);a.c=setInterval(function(){for(var b in a.a){var c=l.localStorage.getItem(b),d=a.b[b];c!=d&&(a.b[b]=c,c=new Kc({type:"storage",key:b,target:window,oldValue:d,newValue:c,a:!0}),a.Pb(c));}},1E3);}function xk(a){a.c&&(clearInterval(a.c),a.c=null);}
  k.Pb=function(a){if(a&&a.f){var b=a.a.key;if(null==b)for(var c in this.a){var d=this.b[c];"undefined"===typeof d&&(d=null);var e=l.localStorage.getItem(c);e!==d&&(this.b[c]=e,this.$a(c));}else if(0==b.indexOf("firebase:")&&this.a[b]){"undefined"!==typeof a.a.a?sk(this,"local").ea(this.f):xk(this);if(this.m)if(c=l.localStorage.getItem(b),d=a.a.newValue,d!==c)null!==d?l.localStorage.setItem(b,d):l.localStorage.removeItem(b);else if(this.b[b]===d&&"undefined"===typeof a.a.a)return;var f=this;c=function(){if("undefined"!==
  typeof a.a.a||f.b[b]!==l.localStorage.getItem(b))f.b[b]=l.localStorage.getItem(b),f.$a(b);};uc&&Fc&&10==Fc&&l.localStorage.getItem(b)!==a.a.newValue&&a.a.newValue!==a.a.oldValue?setTimeout(c,10):c();}}else x(a,t(this.$a,this));};k.$a=function(a){this.a[a]&&x(this.a[a],function(b){b();});};function yk(a){this.a=a;this.b=rk();}var zk={name:"authEvent",C:"local"};function Ak(a){return a.b.get(zk,a.a).then(function(b){return Zg(b)})}function Bk(){this.a=rk();}function Ck(){this.b=-1;}function Dk(a,b){this.b=Ek;this.f=l.Uint8Array?new Uint8Array(this.b):Array(this.b);this.g=this.c=0;this.a=[];this.i=a;this.h=b;this.l=l.Int32Array?new Int32Array(64):Array(64);void 0!==Fk||(l.Int32Array?Fk=new Int32Array(Gk):Fk=Gk);this.reset();}var Fk;v(Dk,Ck);for(var Ek=64,Hk=Ek-1,Ik=[],Jk=0;Jk<Hk;Jk++)Ik[Jk]=0;var Kk=Qa(128,Ik);Dk.prototype.reset=function(){this.g=this.c=0;this.a=l.Int32Array?new Int32Array(this.h):Ra(this.h);};
  function Lk(a){for(var b=a.f,c=a.l,d=0,e=0;e<b.length;)c[d++]=b[e]<<24|b[e+1]<<16|b[e+2]<<8|b[e+3],e=4*d;for(b=16;64>b;b++){e=c[b-15]|0;d=c[b-2]|0;var f=(c[b-16]|0)+((e>>>7|e<<25)^(e>>>18|e<<14)^e>>>3)|0,g=(c[b-7]|0)+((d>>>17|d<<15)^(d>>>19|d<<13)^d>>>10)|0;c[b]=f+g|0;}d=a.a[0]|0;e=a.a[1]|0;var h=a.a[2]|0,m=a.a[3]|0,p=a.a[4]|0,u=a.a[5]|0,A=a.a[6]|0;f=a.a[7]|0;for(b=0;64>b;b++){var C=((d>>>2|d<<30)^(d>>>13|d<<19)^(d>>>22|d<<10))+(d&e^d&h^e&h)|0;g=p&u^~p&A;f=f+((p>>>6|p<<26)^(p>>>11|p<<21)^(p>>>25|p<<
  7))|0;g=g+(Fk[b]|0)|0;g=f+(g+(c[b]|0)|0)|0;f=A;A=u;u=p;p=m+g|0;m=h;h=e;e=d;d=g+C|0;}a.a[0]=a.a[0]+d|0;a.a[1]=a.a[1]+e|0;a.a[2]=a.a[2]+h|0;a.a[3]=a.a[3]+m|0;a.a[4]=a.a[4]+p|0;a.a[5]=a.a[5]+u|0;a.a[6]=a.a[6]+A|0;a.a[7]=a.a[7]+f|0;}
  function Mk(a,b,c){void 0===c&&(c=b.length);var d=0,e=a.c;if(n(b))for(;d<c;)a.f[e++]=b.charCodeAt(d++),e==a.b&&(Lk(a),e=0);else if(oa(b))for(;d<c;){var f=b[d++];if(!("number"==typeof f&&0<=f&&255>=f&&f==(f|0)))throw Error("message must be a byte array");a.f[e++]=f;e==a.b&&(Lk(a),e=0);}else throw Error("message must be string or array");a.c=e;a.g+=c;}
  var Gk=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,
  4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];function Nk(){Dk.call(this,8,Ok);}v(Nk,Dk);var Ok=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];function Pk(a,b,c,d,e){this.u=a;this.i=b;this.l=c;this.m=d||null;this.o=e||null;this.h=b+":"+c;this.v=new Bk;this.g=new yk(this.h);this.f=null;this.b=[];this.a=this.c=null;}function Qk(a){return new M("invalid-cordova-configuration",a)}k=Pk.prototype;
  k.ia=function(){return this.Da?this.Da:this.Da=ve().then(function(){if("function"!==typeof J("universalLinks.subscribe",l))throw Qk("cordova-universal-links-plugin-fix is not installed");if("undefined"===typeof J("BuildInfo.packageName",l))throw Qk("cordova-plugin-buildinfo is not installed");if("function"!==typeof J("cordova.plugins.browsertab.openUrl",l))throw Qk("cordova-plugin-browsertab is not installed");if("function"!==typeof J("cordova.InAppBrowser.open",l))throw Qk("cordova-plugin-inappbrowser is not installed");
  },function(){throw new M("cordova-not-ready");})};function Rk(){for(var a=20,b=[];0<a;)b.push("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(62*Math.random()))),a--;return b.join("")}function Sk(a){var b=new Nk;Mk(b,a);a=[];var c=8*b.g;56>b.c?Mk(b,Kk,56-b.c):Mk(b,Kk,b.b-(b.c-56));for(var d=63;56<=d;d--)b.f[d]=c&255,c/=256;Lk(b);for(d=c=0;d<b.i;d++)for(var e=24;0<=e;e-=8)a[c++]=b.a[d]>>e&255;return Kf(a)}
  k.Fb=function(a,b){b(new M("operation-not-supported-in-this-environment"));return D()};k.Db=function(){return E(new M("operation-not-supported-in-this-environment"))};k.Rb=function(){return !1};k.Ob=function(){return !0};k.Jb=function(){return !0};
  k.Eb=function(a,b,c,d){if(this.c)return E(new M("redirect-operation-pending"));var e=this,f=l.document,g=null,h=null,m=null,p=null;return this.c=D().then(function(){Xg(b);return Tk(e)}).then(function(){return Uk(e,a,b,c,d)}).then(function(){return (new B(function(u,A){h=function(){var C=J("cordova.plugins.browsertab.close",l);u();"function"===typeof C&&C();e.a&&"function"===typeof e.a.close&&(e.a.close(),e.a=null);return !1};e.Aa(h);m=function(){g||(g=nd(2E3).then(function(){A(new M("redirect-cancelled-by-user"));}));};
  p=function(){Qe()&&m();};f.addEventListener("resume",m,!1);I().toLowerCase().match(/android/)||f.addEventListener("visibilitychange",p,!1);})).s(function(u){return Vk(e).then(function(){throw u;})})}).ka(function(){m&&f.removeEventListener("resume",m,!1);p&&f.removeEventListener("visibilitychange",p,!1);g&&g.cancel();h&&e.Na(h);e.c=null;})};
  function Uk(a,b,c,d,e){var f=Rk(),g=new Yg(b,d,null,f,new M("no-auth-event"),null,e),h=J("BuildInfo.packageName",l);if("string"!==typeof h)throw new M("invalid-cordova-configuration");var m=J("BuildInfo.displayName",l),p={};if(I().toLowerCase().match(/iphone|ipad|ipod/))p.ibi=h;else if(I().toLowerCase().match(/android/))p.apn=h;else return E(new M("operation-not-supported-in-this-environment"));m&&(p.appDisplayName=m);f=Sk(f);p.sessionId=f;var u=Bj(a.u,a.i,a.l,b,c,null,d,a.m,p,a.o,e);return a.ia().then(function(){var A=
  a.h;return a.v.a.set(zk,g.A(),A)}).then(function(){var A=J("cordova.plugins.browsertab.isAvailable",l);if("function"!==typeof A)throw new M("invalid-cordova-configuration");var C=null;A(function(N){if(N){C=J("cordova.plugins.browsertab.openUrl",l);if("function"!==typeof C)throw new M("invalid-cordova-configuration");C(u);}else{C=J("cordova.InAppBrowser.open",l);if("function"!==typeof C)throw new M("invalid-cordova-configuration");N=I();a.a=C(u,N.match(/(iPad|iPhone|iPod).*OS 7_\d/i)||N.match(/(iPad|iPhone|iPod).*OS 8_\d/i)?
  "_blank":"_system","location=yes");}});})}function Wk(a,b){for(var c=0;c<a.b.length;c++)try{a.b[c](b);}catch(d){}}function Tk(a){a.f||(a.f=a.ia().then(function(){return new B(function(b){function c(d){b(d);a.Na(c);return !1}a.Aa(c);Xk(a);})}));return a.f}function Vk(a){var b=null;return Ak(a.g).then(function(c){b=c;c=a.g;return vk(c.b,zk,c.a)}).then(function(){return b})}
  function Xk(a){function b(g){d=!0;e&&e.cancel();Vk(a).then(function(h){var m=c;if(h&&g&&g.url){var p=null;m=ig(g.url);-1!=m.indexOf("/__/auth/callback")&&(p=Ld(m),p=Me(Kd(p,"firebaseError")||null),p=(p="object"===typeof p?pf(p):null)?new Yg(h.c,h.b,null,null,p,null,h.R()):new Yg(h.c,h.b,m,h.f,null,null,h.R()));m=p||c;}Wk(a,m);});}var c=new Yg("unknown",null,null,null,new M("no-auth-event")),d=!1,e=nd(500).then(function(){return Vk(a).then(function(){d||Wk(a,c);})}),f=l.handleOpenURL;l.handleOpenURL=function(g){0==
  g.toLowerCase().indexOf(J("BuildInfo.packageName",l).toLowerCase()+"://")&&b({url:g});if("function"===typeof f)try{f(g);}catch(h){console.error(h);}};ah||(ah=new $g);bh(b);}k.Aa=function(a){this.b.push(a);Tk(this).s(function(b){"auth/invalid-cordova-configuration"===b.code&&(b=new Yg("unknown",null,null,null,new M("no-auth-event")),a(b));});};k.Na=function(a){Pa(this.b,function(b){return b==a});};function Yk(a){this.a=a;this.b=rk();}var Zk={name:"pendingRedirect",C:"session"};function $k(a){return a.b.set(Zk,"pending",a.a)}function al(a){return vk(a.b,Zk,a.a)}function bl(a){return a.b.get(Zk,a.a).then(function(b){return "pending"==b})}function cl(a,b,c){this.i={};this.v=0;this.B=a;this.u=b;this.m=c;this.h=[];this.f=!1;this.l=t(this.o,this);this.b=new dl;this.w=new el;this.g=new Yk(this.u+":"+this.m);this.c={};this.c.unknown=this.b;this.c.signInViaRedirect=this.b;this.c.linkViaRedirect=this.b;this.c.reauthViaRedirect=this.b;this.c.signInViaPopup=this.w;this.c.linkViaPopup=this.w;this.c.reauthViaPopup=this.w;this.a=fl(this.B,this.u,this.m,Vf);}
  function fl(a,b,c,d){var e=firebase.SDK_VERSION||null;return we()?new Pk(a,b,c,e,d):new vj(a,b,c,e,d)}cl.prototype.reset=function(){this.f=!1;this.a.Na(this.l);this.a=fl(this.B,this.u,this.m);this.i={};};function gl(a){a.f||(a.f=!0,a.a.Aa(a.l));var b=a.a;return a.a.ia().s(function(c){a.a==b&&a.reset();throw c;})}function hl(a){a.a.Ob()&&gl(a).s(function(b){var c=new Yg("unknown",null,null,null,new M("operation-not-supported-in-this-environment"));il(b)&&a.o(c);});a.a.Jb()||jl(a.b);}
  function kl(a,b){Na(a.h,b)||a.h.push(b);a.f||bl(a.g).then(function(c){c?al(a.g).then(function(){gl(a).s(function(d){var e=new Yg("unknown",null,null,null,new M("operation-not-supported-in-this-environment"));il(d)&&a.o(e);});}):hl(a);}).s(function(){hl(a);});}function ll(a,b){Pa(a.h,function(c){return c==b});}
  cl.prototype.o=function(a){if(!a)throw new M("invalid-auth-event");6E5<=ua()-this.v&&(this.i={},this.v=0);if(a&&a.getUid()&&this.i.hasOwnProperty(a.getUid()))return !1;for(var b=!1,c=0;c<this.h.length;c++){var d=this.h[c];if(d.xb(a.c,a.b)){if(b=this.c[a.c])b.h(a,d),a&&(a.f||a.b)&&(this.i[a.getUid()]=!0,this.v=ua());b=!0;break}}jl(this.b);return b};var ml=new Pe(2E3,1E4),nl=new Pe(3E4,6E4);cl.prototype.oa=function(){return this.b.oa()};
  function ol(a,b,c,d,e,f,g){return a.a.Db(b,c,d,function(){a.f||(a.f=!0,a.a.Aa(a.l));},function(){a.reset();},e,f,g)}function il(a){return a&&"auth/cordova-not-ready"==a.code?!0:!1}
  function pl(a,b,c,d,e){var f;return $k(a.g).then(function(){return a.a.Eb(b,c,d,e).s(function(g){if(il(g))throw new M("operation-not-supported-in-this-environment");f=g;return al(a.g).then(function(){throw f;})}).then(function(){return a.a.Rb()?new B(function(){}):al(a.g).then(function(){return a.oa()}).then(function(){}).s(function(){})})})}function ql(a,b,c,d,e){return a.a.Fb(d,function(f){b.ja(c,null,f,e);},ml.get())}var rl={};
  function sl(a,b,c){var d=b+":"+c;rl[d]||(rl[d]=new cl(a,b,c));return rl[d]}function dl(){this.b=null;this.f=[];this.c=[];this.a=null;this.i=this.g=!1;}dl.prototype.reset=function(){this.b=null;this.a&&(this.a.cancel(),this.a=null);};
  dl.prototype.h=function(a,b){if(a){this.reset();this.g=!0;var c=a.c,d=a.b,e=a.a&&"auth/web-storage-unsupported"==a.a.code,f=a.a&&"auth/operation-not-supported-in-this-environment"==a.a.code;this.i=!(!e&&!f);"unknown"!=c||e||f?a.a?(tl(this,!0,null,a.a),D()):b.Ba(c,d)?ul(this,a,b):E(new M("invalid-auth-event")):(tl(this,!1,null,null),D());}else E(new M("invalid-auth-event"));};function jl(a){a.g||(a.g=!0,tl(a,!1,null,null));}function vl(a){a.g&&!a.i&&tl(a,!1,null,null);}
  function ul(a,b,c){c=c.Ba(b.c,b.b);var d=b.g,e=b.f,f=b.i,g=b.R(),h=!!b.c.match(/Redirect$/);c(d,e,g,f).then(function(m){tl(a,h,m,null);}).s(function(m){tl(a,h,null,m);});}function wl(a,b){a.b=function(){return E(b)};if(a.c.length)for(var c=0;c<a.c.length;c++)a.c[c](b);}function xl(a,b){a.b=function(){return D(b)};if(a.f.length)for(var c=0;c<a.f.length;c++)a.f[c](b);}function tl(a,b,c,d){b?d?wl(a,d):xl(a,c):xl(a,{user:null});a.f=[];a.c=[];}
  dl.prototype.oa=function(){var a=this;return new B(function(b,c){a.b?a.b().then(b,c):(a.f.push(b),a.c.push(c),yl(a));})};function yl(a){var b=new M("timeout");a.a&&a.a.cancel();a.a=nd(nl.get()).then(function(){a.b||(a.g=!0,tl(a,!0,null,b));});}function el(){}el.prototype.h=function(a,b){if(a){var c=a.c,d=a.b;a.a?(b.ja(a.c,null,a.a,a.b),D()):b.Ba(c,d)?zl(a,b):E(new M("invalid-auth-event"));}else E(new M("invalid-auth-event"));};
  function zl(a,b){var c=a.b,d=a.c;b.Ba(d,c)(a.g,a.f,a.R(),a.i).then(function(e){b.ja(d,e,null,c);}).s(function(e){b.ja(d,null,e,c);});}function Al(){this.vb=!1;Object.defineProperty(this,"appVerificationDisabled",{get:function(){return this.vb},set:function(a){this.vb=a;},enumerable:!1});}function Bl(a,b){this.a=b;K(this,"verificationId",a);}Bl.prototype.confirm=function(a){a=Vg(this.verificationId,a);return this.a(a)};function Cl(a,b,c,d){return (new Tg(a)).Wa(b,c).then(function(e){return new Bl(e,d)})}function Dl(a){var b=Sf(a);if(!(b&&b.exp&&b.auth_time&&b.iat))throw new M("internal-error","An internal error occurred. The token obtained by Firebase appears to be malformed. Please retry the operation.");L(this,{token:a,expirationTime:Se(1E3*b.exp),authTime:Se(1E3*b.auth_time),issuedAtTime:Se(1E3*b.iat),signInProvider:b.firebase&&b.firebase.sign_in_provider?b.firebase.sign_in_provider:null,claims:b});}function El(a,b,c){this.h=a;this.i=b;this.g=c;this.c=3E4;this.f=96E4;this.b=null;this.a=this.c;if(this.f<this.c)throw Error("Proactive refresh lower bound greater than upper bound!");}El.prototype.start=function(){this.a=this.c;Fl(this,!0);};function Gl(a,b){if(b)return a.a=a.c,a.g();b=a.a;a.a*=2;a.a>a.f&&(a.a=a.f);return b}function Fl(a,b){a.stop();a.b=nd(Gl(a,b)).then(function(){return Re()}).then(function(){return a.h()}).then(function(){Fl(a,!0);}).s(function(c){a.i(c)&&Fl(a,!1);});}
  El.prototype.stop=function(){this.b&&(this.b.cancel(),this.b=null);};function Hl(a){this.f=a;this.b=this.a=null;this.c=0;}Hl.prototype.A=function(){return {apiKey:this.f.c,refreshToken:this.a,accessToken:this.b,expirationTime:this.c}};function Il(a,b){var c=b[lg],d=b.refreshToken;b=Jl(b.expiresIn);a.b=c;a.c=b;a.a=d;}function Kl(a,b){a.b=b.b;a.a=b.a;a.c=b.c;}function Jl(a){return ua()+1E3*parseInt(a,10)}
  function Ll(a,b){return zi(a.f,b).then(function(c){a.b=c.access_token;a.c=Jl(c.expires_in);a.a=c.refresh_token;return {accessToken:a.b,expirationTime:a.c,refreshToken:a.a}}).s(function(c){"auth/user-token-expired"==c.code&&(a.a=null);throw c;})}Hl.prototype.getToken=function(a){a=!!a;return this.b&&!this.a?E(new M("user-token-expired")):a||!this.b||ua()>this.c-3E4?this.a?Ll(this,{grant_type:"refresh_token",refresh_token:this.a}):D(null):D({accessToken:this.b,expirationTime:this.c,refreshToken:this.a})};function Ml(a,b){this.a=a||null;this.b=b||null;L(this,{lastSignInTime:Se(b||null),creationTime:Se(a||null)});}function Nl(a){return new Ml(a.a,a.b)}Ml.prototype.A=function(){return {lastLoginAt:this.b,createdAt:this.a}};function Ol(a,b,c,d,e,f){L(this,{uid:a,displayName:d||null,photoURL:e||null,email:c||null,phoneNumber:f||null,providerId:b});}function Pl(a,b){F.call(this,a);for(var c in b)this[c]=b[c];}v(Pl,F);
  function Q(a,b,c){this.I=[];this.l=a.apiKey;this.m=a.appName;this.o=a.authDomain||null;a=firebase.SDK_VERSION?Ee(firebase.SDK_VERSION):null;this.a=new ni(this.l,Uf(Vf),a);this.b=new Hl(this.a);Ql(this,b[lg]);Il(this.b,b);K(this,"refreshToken",this.b.a);Rl(this,c||{});G.call(this);this.J=!1;this.o&&He()&&(this.i=sl(this.o,this.l,this.m));this.O=[];this.h=null;this.w=Sl(this);this.W=t(this.Ja,this);var d=this;this.ga=null;this.xa=function(e){d.ua(e.g);};this.Z=null;this.P=[];this.wa=function(e){Tl(d,
  e.c);};this.Y=null;}v(Q,G);Q.prototype.ua=function(a){this.ga=a;ti(this.a,a);};Q.prototype.ha=function(){return this.ga};function Ul(a,b){a.Z&&fd(a.Z,"languageCodeChanged",a.xa);(a.Z=b)&&Wc(b,"languageCodeChanged",a.xa);}function Tl(a,b){a.P=b;ui(a.a,firebase.SDK_VERSION?Ee(firebase.SDK_VERSION,a.P):null);}Q.prototype.Ca=function(){return Ra(this.P)};function Vl(a,b){a.Y&&fd(a.Y,"frameworkChanged",a.wa);(a.Y=b)&&Wc(b,"frameworkChanged",a.wa);}Q.prototype.Ja=function(){this.w.b&&(this.w.stop(),this.w.start());};
  function Wl(a){try{return firebase.app(a.m).auth()}catch(b){throw new M("internal-error","No firebase.auth.Auth instance is available for the Firebase App '"+a.m+"'!");}}function Sl(a){return new El(function(){return a.G(!0)},function(b){return b&&"auth/network-request-failed"==b.code?!0:!1},function(){var b=a.b.c-ua()-3E5;return 0<b?b:0})}function Xl(a){a.B||a.w.b||(a.w.start(),fd(a,"tokenChanged",a.W),Wc(a,"tokenChanged",a.W));}function Yl(a){fd(a,"tokenChanged",a.W);a.w.stop();}
  function Ql(a,b){a.ma=b;K(a,"_lat",b);}function Zl(a,b){Pa(a.O,function(c){return c==b});}function $l(a){for(var b=[],c=0;c<a.O.length;c++)b.push(a.O[c](a));return bc(b).then(function(){return a})}function am(a){a.i&&!a.J&&(a.J=!0,kl(a.i,a));}
  function Rl(a,b){L(a,{uid:b.uid,displayName:b.displayName||null,photoURL:b.photoURL||null,email:b.email||null,emailVerified:b.emailVerified||!1,phoneNumber:b.phoneNumber||null,isAnonymous:b.isAnonymous||!1,tenantId:b.tenantId||null,metadata:new Ml(b.createdAt,b.lastLoginAt),providerData:[]});a.a.b=a.tenantId;}K(Q.prototype,"providerId","firebase");function bm(){}function cm(a){return D().then(function(){if(a.B)throw new M("app-deleted");})}
  function dm(a){return Ja(a.providerData,function(b){return b.providerId})}function em(a,b){b&&(fm(a,b.providerId),a.providerData.push(b));}function fm(a,b){Pa(a.providerData,function(c){return c.providerId==b});}function gm(a,b,c){("uid"!=b||c)&&a.hasOwnProperty(b)&&K(a,b,c);}
  function hm(a,b){a!=b&&(L(a,{uid:b.uid,displayName:b.displayName,photoURL:b.photoURL,email:b.email,emailVerified:b.emailVerified,phoneNumber:b.phoneNumber,isAnonymous:b.isAnonymous,tenantId:b.tenantId,providerData:[]}),b.metadata?K(a,"metadata",Nl(b.metadata)):K(a,"metadata",new Ml),x(b.providerData,function(c){em(a,c);}),Kl(a.b,b.b),K(a,"refreshToken",a.b.a));}k=Q.prototype;k.reload=function(){var a=this;return R(this,cm(this).then(function(){return im(a).then(function(){return $l(a)}).then(bm)}))};
  function im(a){return a.G().then(function(b){var c=a.isAnonymous;return jm(a,b).then(function(){c||gm(a,"isAnonymous",!1);return b})})}k.dc=function(a){return this.G(a).then(function(b){return new Dl(b)})};k.G=function(a){var b=this;return R(this,cm(this).then(function(){return b.b.getToken(a)}).then(function(c){if(!c)throw new M("internal-error");c.accessToken!=b.ma&&(Ql(b,c.accessToken),b.dispatchEvent(new Pl("tokenChanged")));gm(b,"refreshToken",c.refreshToken);return c.accessToken}))};
  function km(a,b){b[lg]&&a.ma!=b[lg]&&(Il(a.b,b),a.dispatchEvent(new Pl("tokenChanged")),Ql(a,b[lg]),gm(a,"refreshToken",a.b.a));}function jm(a,b){return P(a.a,gj,{idToken:b}).then(t(a.zc,a))}
  k.zc=function(a){a=a.users;if(!a||!a.length)throw new M("internal-error");a=a[0];Rl(this,{uid:a.localId,displayName:a.displayName,photoURL:a.photoUrl,email:a.email,emailVerified:!!a.emailVerified,phoneNumber:a.phoneNumber,lastLoginAt:a.lastLoginAt,createdAt:a.createdAt,tenantId:a.tenantId});for(var b=lm(a),c=0;c<b.length;c++)em(this,b[c]);gm(this,"isAnonymous",!(this.email&&a.passwordHash)&&!(this.providerData&&this.providerData.length));};
  function lm(a){return (a=a.providerUserInfo)&&a.length?Ja(a,function(b){return new Ol(b.rawId,b.providerId,b.email,b.displayName,b.photoUrl,b.phoneNumber)}):[]}k.Ac=function(a){Xe("firebase.User.prototype.reauthenticateAndRetrieveDataWithCredential is deprecated. Please use firebase.User.prototype.reauthenticateWithCredential instead.");return this.hb(a)};
  k.hb=function(a){var b=this,c=null;return R(this,a.f(this.a,this.uid).then(function(d){km(b,d);c=mm(b,d,"reauthenticate");b.h=null;return b.reload()}).then(function(){return c}),!0)};function nm(a,b){return im(a).then(function(){if(Na(dm(a),b))return $l(a).then(function(){throw new M("provider-already-linked");})})}k.rc=function(a){Xe("firebase.User.prototype.linkAndRetrieveDataWithCredential is deprecated. Please use firebase.User.prototype.linkWithCredential instead.");return this.fb(a)};
  k.fb=function(a){var b=this,c=null;return R(this,nm(this,a.providerId).then(function(){return b.G()}).then(function(d){return a.b(b.a,d)}).then(function(d){c=mm(b,d,"link");return om(b,d)}).then(function(){return c}))};k.sc=function(a,b){var c=this;return R(this,nm(this,"phone").then(function(){return Cl(Wl(c),a,b,t(c.fb,c))}))};k.Bc=function(a,b){var c=this;return R(this,D().then(function(){return Cl(Wl(c),a,b,t(c.hb,c))}),!0)};
  function mm(a,b,c){var d=Wg(b);b=$f(b);return $e({user:a,credential:d,additionalUserInfo:b,operationType:c})}function om(a,b){km(a,b);return a.reload().then(function(){return a})}k.rb=function(a){var b=this;return R(this,this.G().then(function(c){return b.a.rb(c,a)}).then(function(c){km(b,c);return b.reload()}))};k.Sc=function(a){var b=this;return R(this,this.G().then(function(c){return a.b(b.a,c)}).then(function(c){km(b,c);return b.reload()}))};
  k.sb=function(a){var b=this;return R(this,this.G().then(function(c){return b.a.sb(c,a)}).then(function(c){km(b,c);return b.reload()}))};
  k.tb=function(a){if(void 0===a.displayName&&void 0===a.photoURL)return cm(this);var b=this;return R(this,this.G().then(function(c){return b.a.tb(c,{displayName:a.displayName,photoUrl:a.photoURL})}).then(function(c){km(b,c);gm(b,"displayName",c.displayName||null);gm(b,"photoURL",c.photoUrl||null);x(b.providerData,function(d){"password"===d.providerId&&(K(d,"displayName",b.displayName),K(d,"photoURL",b.photoURL));});return $l(b)}).then(bm))};
  k.Qc=function(a){var b=this;return R(this,im(this).then(function(c){return Na(dm(b),a)?Si(b.a,c,[a]).then(function(d){var e={};x(d.providerUserInfo||[],function(f){e[f.providerId]=!0;});x(dm(b),function(f){e[f]||fm(b,f);});e[Tg.PROVIDER_ID]||K(b,"phoneNumber",null);return $l(b)}):$l(b).then(function(){throw new M("no-such-provider");})}))};
  k.delete=function(){var a=this;return R(this,this.G().then(function(b){return P(a.a,fj,{idToken:b})}).then(function(){a.dispatchEvent(new Pl("userDeleted"));})).then(function(){for(var b=0;b<a.I.length;b++)a.I[b].cancel("app-deleted");Ul(a,null);Vl(a,null);a.I=[];a.B=!0;Yl(a);K(a,"refreshToken",null);a.i&&ll(a.i,a);})};
  k.xb=function(a,b){return "linkViaPopup"==a&&(this.g||null)==b&&this.f||"reauthViaPopup"==a&&(this.g||null)==b&&this.f||"linkViaRedirect"==a&&(this.ca||null)==b||"reauthViaRedirect"==a&&(this.ca||null)==b?!0:!1};k.ja=function(a,b,c,d){"linkViaPopup"!=a&&"reauthViaPopup"!=a||d!=(this.g||null)||(c&&this.v?this.v(c):b&&!c&&this.f&&this.f(b),this.c&&(this.c.cancel(),this.c=null),delete this.f,delete this.v);};
  k.Ba=function(a,b){return "linkViaPopup"==a&&b==(this.g||null)?t(this.Bb,this):"reauthViaPopup"==a&&b==(this.g||null)?t(this.Cb,this):"linkViaRedirect"==a&&(this.ca||null)==b?t(this.Bb,this):"reauthViaRedirect"==a&&(this.ca||null)==b?t(this.Cb,this):null};k.tc=function(a){var b=this;return pm(this,"linkViaPopup",a,function(){return nm(b,a.providerId).then(function(){return $l(b)})},!1)};k.Cc=function(a){return pm(this,"reauthViaPopup",a,function(){return D()},!0)};
  function pm(a,b,c,d,e){if(!He())return E(new M("operation-not-supported-in-this-environment"));if(a.h&&!e)return E(a.h);var f=Zf(c.providerId),g=Ge(a.uid+":::"),h=null;(!Je()||ye())&&a.o&&c.isOAuthProvider&&(h=Bj(a.o,a.l,a.m,b,c,null,g,firebase.SDK_VERSION||null,null,null,a.tenantId));var m=pe(h,f&&f.sa,f&&f.ra);d=d().then(function(){qm(a);if(!e)return a.G().then(function(){})}).then(function(){return ol(a.i,m,b,c,g,!!h,a.tenantId)}).then(function(){return new B(function(p,u){a.ja(b,null,new M("cancelled-popup-request"),
  a.g||null);a.f=p;a.v=u;a.g=g;a.c=ql(a.i,a,b,m,g);})}).then(function(p){m&&oe(m);return p?$e(p):null}).s(function(p){m&&oe(m);throw p;});return R(a,d,e)}k.uc=function(a){var b=this;return rm(this,"linkViaRedirect",a,function(){return nm(b,a.providerId)},!1)};k.Dc=function(a){return rm(this,"reauthViaRedirect",a,function(){return D()},!0)};
  function rm(a,b,c,d,e){if(!He())return E(new M("operation-not-supported-in-this-environment"));if(a.h&&!e)return E(a.h);var f=null,g=Ge(a.uid+":::");d=d().then(function(){qm(a);if(!e)return a.G().then(function(){})}).then(function(){a.ca=g;return $l(a)}).then(function(h){a.da&&(h=a.da,h=h.b.set(sm,a.A(),h.a));return h}).then(function(){return pl(a.i,b,c,g,a.tenantId)}).s(function(h){f=h;if(a.da)return tm(a.da);throw f;}).then(function(){if(f)throw f;});return R(a,d,e)}
  function qm(a){if(!a.i||!a.J){if(a.i&&!a.J)throw new M("internal-error");throw new M("auth-domain-config-required");}}k.Bb=function(a,b,c,d){var e=this;this.c&&(this.c.cancel(),this.c=null);var f=null;c=this.G().then(function(g){return pg(e.a,{requestUri:a,postBody:d,sessionId:b,idToken:g})}).then(function(g){f=mm(e,g,"link");return om(e,g)}).then(function(){return f});return R(this,c)};
  k.Cb=function(a,b,c,d){var e=this;this.c&&(this.c.cancel(),this.c=null);var f=null,g=D().then(function(){return kg(qg(e.a,{requestUri:a,sessionId:b,postBody:d,tenantId:c}),e.uid)}).then(function(h){f=mm(e,h,"reauthenticate");km(e,h);e.h=null;return e.reload()}).then(function(){return f});return R(this,g,!0)};
  k.jb=function(a){var b=this,c=null;return R(this,this.G().then(function(d){c=d;return "undefined"===typeof a||Ta(a)?{}:Jf(new zf(a))}).then(function(d){return b.a.jb(c,d)}).then(function(d){if(b.email!=d)return b.reload()}).then(function(){}))};function R(a,b,c){var d=um(a,b,c);a.I.push(d);d.ka(function(){Oa(a.I,d);});return d}
  function um(a,b,c){return a.h&&!c?(b.cancel(),E(a.h)):b.s(function(d){!d||"auth/user-disabled"!=d.code&&"auth/user-token-expired"!=d.code||(a.h||a.dispatchEvent(new Pl("userInvalidated")),a.h=d);throw d;})}k.toJSON=function(){return this.A()};
  k.A=function(){var a={uid:this.uid,displayName:this.displayName,photoURL:this.photoURL,email:this.email,emailVerified:this.emailVerified,phoneNumber:this.phoneNumber,isAnonymous:this.isAnonymous,tenantId:this.tenantId,providerData:[],apiKey:this.l,appName:this.m,authDomain:this.o,stsTokenManager:this.b.A(),redirectEventId:this.ca||null};this.metadata&&Wa(a,this.metadata.A());x(this.providerData,function(b){a.providerData.push(af(b));});return a};
  function vm(a){if(!a.apiKey)return null;var b={apiKey:a.apiKey,authDomain:a.authDomain,appName:a.appName},c={};if(a.stsTokenManager&&a.stsTokenManager.accessToken&&a.stsTokenManager.expirationTime)c[lg]=a.stsTokenManager.accessToken,c.refreshToken=a.stsTokenManager.refreshToken||null,c.expiresIn=(a.stsTokenManager.expirationTime-ua())/1E3;else return null;var d=new Q(b,c,a);a.providerData&&x(a.providerData,function(e){e&&em(d,$e(e));});a.redirectEventId&&(d.ca=a.redirectEventId);return d}
  function wm(a,b,c,d){var e=new Q(a,b);c&&(e.da=c);d&&Tl(e,d);return e.reload().then(function(){return e})}function xm(a,b,c,d){b=b||{apiKey:a.l,authDomain:a.o,appName:a.m};var e=a.b,f={};f[lg]=e.b;f.refreshToken=e.a;f.expiresIn=(e.c-ua())/1E3;b=new Q(b,f);c&&(b.da=c);d&&Tl(b,d);hm(b,a);return b}function ym(a){this.a=a;this.b=rk();}var sm={name:"redirectUser",C:"session"};function tm(a){return vk(a.b,sm,a.a)}function zm(a,b){return a.b.get(sm,a.a).then(function(c){c&&b&&(c.authDomain=b);return vm(c||{})})}function Am(a){this.a=a;this.b=rk();this.c=null;this.f=Bm(this);this.b.addListener(Cm("local"),this.a,t(this.g,this));}Am.prototype.g=function(){var a=this,b=Cm("local");Dm(this,function(){return D().then(function(){return a.c&&"local"!=a.c.C?a.b.get(b,a.a):null}).then(function(c){if(c)return Em(a,"local").then(function(){a.c=b;})})});};function Em(a,b){var c=[],d;for(d in nk)nk[d]!==b&&c.push(vk(a.b,Cm(nk[d]),a.a));c.push(vk(a.b,Fm,a.a));return ac(c)}
  function Bm(a){var b=Cm("local"),c=Cm("session"),d=Cm("none");return uk(a.b,b,a.a).then(function(){return a.b.get(c,a.a)}).then(function(e){return e?c:a.b.get(d,a.a).then(function(f){return f?d:a.b.get(b,a.a).then(function(g){return g?b:a.b.get(Fm,a.a).then(function(h){return h?Cm(h):b})})})}).then(function(e){a.c=e;return Em(a,e.C)}).s(function(){a.c||(a.c=b);})}var Fm={name:"persistence",C:"session"};function Cm(a){return {name:"authUser",C:a}}
  Am.prototype.mb=function(a){var b=null,c=this;ok(a);return Dm(this,function(){return a!=c.c.C?c.b.get(c.c,c.a).then(function(d){b=d;return Em(c,a)}).then(function(){c.c=Cm(a);if(b)return c.b.set(c.c,b,c.a)}):D()})};function Gm(a){return Dm(a,function(){return a.b.set(Fm,a.c.C,a.a)})}function Hm(a,b){return Dm(a,function(){return a.b.set(a.c,b.A(),a.a)})}function Im(a){return Dm(a,function(){return vk(a.b,a.c,a.a)})}
  function Jm(a,b){return Dm(a,function(){return a.b.get(a.c,a.a).then(function(c){c&&b&&(c.authDomain=b);return vm(c||{})})})}function Dm(a,b){a.f=a.f.then(b,b);return a.f}function Km(a){this.l=!1;K(this,"settings",new Al);K(this,"app",a);if(S(this).options&&S(this).options.apiKey)a=firebase.SDK_VERSION?Ee(firebase.SDK_VERSION):null,this.b=new ni(S(this).options&&S(this).options.apiKey,Uf(Vf),a);else throw new M("invalid-api-key");this.O=[];this.m=[];this.J=[];this.Ub=firebase.INTERNAL.createSubscribe(t(this.oc,this));this.W=void 0;this.Vb=firebase.INTERNAL.createSubscribe(t(this.pc,this));Lm(this,null);this.h=new Am(S(this).options.apiKey+":"+S(this).name);this.w=
  new ym(S(this).options.apiKey+":"+S(this).name);this.Y=T(this,Mm(this));this.i=T(this,Nm(this));this.ga=!1;this.ma=t(this.Nc,this);this.ub=t(this.aa,this);this.wa=t(this.bc,this);this.xa=t(this.mc,this);this.Ja=t(this.nc,this);this.a=null;Om(this);this.INTERNAL={};this.INTERNAL["delete"]=t(this.delete,this);this.INTERNAL.logFramework=t(this.vc,this);this.o=0;G.call(this);Pm(this);this.I=[];}v(Km,G);function Qm(a){F.call(this,"languageCodeChanged");this.g=a;}v(Qm,F);
  function Rm(a){F.call(this,"frameworkChanged");this.c=a;}v(Rm,F);k=Km.prototype;k.mb=function(a){a=this.h.mb(a);return T(this,a)};k.ua=function(a){this.Z===a||this.l||(this.Z=a,ti(this.b,this.Z),this.dispatchEvent(new Qm(this.ha())));};k.ha=function(){return this.Z};k.Tc=function(){var a=l.navigator;this.ua(a?a.languages&&a.languages[0]||a.language||a.userLanguage||null:null);};k.vc=function(a){this.I.push(a);ui(this.b,firebase.SDK_VERSION?Ee(firebase.SDK_VERSION,this.I):null);this.dispatchEvent(new Rm(this.I));};
  k.Ca=function(){return Ra(this.I)};k.nb=function(a){this.P===a||this.l||(this.P=a,this.b.b=this.P);};k.R=function(){return this.P};function Pm(a){Object.defineProperty(a,"lc",{get:function(){return this.ha()},set:function(b){this.ua(b);},enumerable:!1});a.Z=null;Object.defineProperty(a,"ti",{get:function(){return this.R()},set:function(b){this.nb(b);},enumerable:!1});a.P=null;}
  k.toJSON=function(){return {apiKey:S(this).options.apiKey,authDomain:S(this).options.authDomain,appName:S(this).name,currentUser:U(this)&&U(this).A()}};function Sm(a){return a.Tb||E(new M("auth-domain-config-required"))}function Om(a){var b=S(a).options.authDomain,c=S(a).options.apiKey;b&&He()&&(a.Tb=a.Y.then(function(){if(!a.l){a.a=sl(b,c,S(a).name);kl(a.a,a);U(a)&&am(U(a));if(a.B){am(a.B);var d=a.B;d.ua(a.ha());Ul(d,a);d=a.B;Tl(d,a.I);Vl(d,a);a.B=null;}return a.a}}));}
  k.xb=function(a,b){switch(a){case "unknown":case "signInViaRedirect":return !0;case "signInViaPopup":return this.g==b&&!!this.f;default:return !1}};k.ja=function(a,b,c,d){"signInViaPopup"==a&&this.g==d&&(c&&this.v?this.v(c):b&&!c&&this.f&&this.f(b),this.c&&(this.c.cancel(),this.c=null),delete this.f,delete this.v);};k.Ba=function(a,b){return "signInViaRedirect"==a||"signInViaPopup"==a&&this.g==b&&this.f?t(this.ac,this):null};
  k.ac=function(a,b,c,d){var e=this;a={requestUri:a,postBody:d,sessionId:b,tenantId:c};this.c&&(this.c.cancel(),this.c=null);var f=null,g=null,h=ng(e.b,a).then(function(m){f=Wg(m);g=$f(m);return m});a=e.Y.then(function(){return h}).then(function(m){return Tm(e,m)}).then(function(){return $e({user:U(e),credential:f,additionalUserInfo:g,operationType:"signIn"})});return T(this,a)};
  k.Lc=function(a){if(!He())return E(new M("operation-not-supported-in-this-environment"));var b=this,c=Zf(a.providerId),d=Ge(),e=null;(!Je()||ye())&&S(this).options.authDomain&&a.isOAuthProvider&&(e=Bj(S(this).options.authDomain,S(this).options.apiKey,S(this).name,"signInViaPopup",a,null,d,firebase.SDK_VERSION||null,null,null,this.R()));var f=pe(e,c&&c.sa,c&&c.ra);c=Sm(this).then(function(g){return ol(g,f,"signInViaPopup",a,d,!!e,b.R())}).then(function(){return new B(function(g,h){b.ja("signInViaPopup",
  null,new M("cancelled-popup-request"),b.g);b.f=g;b.v=h;b.g=d;b.c=ql(b.a,b,"signInViaPopup",f,d);})}).then(function(g){f&&oe(f);return g?$e(g):null}).s(function(g){f&&oe(f);throw g;});return T(this,c)};k.Mc=function(a){if(!He())return E(new M("operation-not-supported-in-this-environment"));var b=this,c=Sm(this).then(function(){return Gm(b.h)}).then(function(){return pl(b.a,"signInViaRedirect",a,void 0,b.R())});return T(this,c)};
  function Um(a){if(!He())return E(new M("operation-not-supported-in-this-environment"));var b=Sm(a).then(function(){return a.a.oa()}).then(function(c){return c?$e(c):null});return T(a,b)}k.oa=function(){var a=this;return Um(this).then(function(b){a.a&&vl(a.a.b);return b}).s(function(b){a.a&&vl(a.a.b);throw b;})};
  k.Rc=function(a){if(!a)return E(new M("null-user"));if(this.P!=a.tenantId)return E(new M("tenant-id-mismatch"));var b=this,c={};c.apiKey=S(this).options.apiKey;c.authDomain=S(this).options.authDomain;c.appName=S(this).name;var d=xm(a,c,b.w,b.Ca());return T(this,this.i.then(function(){if(S(b).options.apiKey!=a.l)return d.reload()}).then(function(){if(U(b)&&a.uid==U(b).uid)return hm(U(b),a),b.aa(a);Lm(b,d);am(d);return b.aa(d)}).then(function(){Vm(b);}))};
  function Tm(a,b){var c={};c.apiKey=S(a).options.apiKey;c.authDomain=S(a).options.authDomain;c.appName=S(a).name;return a.Y.then(function(){return wm(c,b,a.w,a.Ca())}).then(function(d){if(U(a)&&d.uid==U(a).uid)return hm(U(a),d),a.aa(d);Lm(a,d);am(d);return a.aa(d)}).then(function(){Vm(a);})}
  function Lm(a,b){U(a)&&(Zl(U(a),a.ub),fd(U(a),"tokenChanged",a.wa),fd(U(a),"userDeleted",a.xa),fd(U(a),"userInvalidated",a.Ja),Yl(U(a)));b&&(b.O.push(a.ub),Wc(b,"tokenChanged",a.wa),Wc(b,"userDeleted",a.xa),Wc(b,"userInvalidated",a.Ja),0<a.o&&Xl(b));K(a,"currentUser",b);b&&(b.ua(a.ha()),Ul(b,a),Tl(b,a.I),Vl(b,a));}k.pb=function(){var a=this,b=this.i.then(function(){a.a&&vl(a.a.b);if(!U(a))return D();Lm(a,null);return Im(a.h).then(function(){Vm(a);})});return T(this,b)};
  function Wm(a){var b=zm(a.w,S(a).options.authDomain).then(function(c){if(a.B=c)c.da=a.w;return tm(a.w)});return T(a,b)}function Mm(a){var b=S(a).options.authDomain,c=Wm(a).then(function(){return Jm(a.h,b)}).then(function(d){return d?(d.da=a.w,a.B&&(a.B.ca||null)==(d.ca||null)?d:d.reload().then(function(){return Hm(a.h,d).then(function(){return d})}).s(function(e){return "auth/network-request-failed"==e.code?d:Im(a.h)})):null}).then(function(d){Lm(a,d||null);});return T(a,c)}
  function Nm(a){return a.Y.then(function(){return Um(a)}).s(function(){}).then(function(){if(!a.l)return a.ma()}).s(function(){}).then(function(){if(!a.l){a.ga=!0;var b=a.h;b.b.addListener(Cm("local"),b.a,a.ma);}})}
  k.Nc=function(){var a=this;return Jm(this.h,S(this).options.authDomain).then(function(b){if(!a.l){var c;if(c=U(a)&&b){c=U(a).uid;var d=b.uid;c=void 0===c||null===c||""===c||void 0===d||null===d||""===d?!1:c==d;}if(c)return hm(U(a),b),U(a).G();if(U(a)||b)Lm(a,b),b&&(am(b),b.da=a.w),a.a&&kl(a.a,a),Vm(a);}})};k.aa=function(a){return Hm(this.h,a)};k.bc=function(){Vm(this);this.aa(U(this));};k.mc=function(){this.pb();};k.nc=function(){this.pb();};
  function Xm(a,b){var c=null,d=null;return T(a,b.then(function(e){c=Wg(e);d=$f(e);return Tm(a,e)}).then(function(){return $e({user:U(a),credential:c,additionalUserInfo:d,operationType:"signIn"})}))}k.oc=function(a){var b=this;this.addAuthTokenListener(function(){a.next(U(b));});};k.pc=function(a){var b=this;Ym(this,function(){a.next(U(b));});};k.xc=function(a,b,c){var d=this;this.ga&&Promise.resolve().then(function(){q(a)?a(U(d)):q(a.next)&&a.next(U(d));});return this.Ub(a,b,c)};
  k.wc=function(a,b,c){var d=this;this.ga&&Promise.resolve().then(function(){d.W=d.getUid();q(a)?a(U(d)):q(a.next)&&a.next(U(d));});return this.Vb(a,b,c)};k.cc=function(a){var b=this,c=this.i.then(function(){return U(b)?U(b).G(a).then(function(d){return {accessToken:d}}):null});return T(this,c)};k.Hc=function(a){var b=this;return this.i.then(function(){return Xm(b,P(b.b,ij,{token:a}))}).then(function(c){var d=c.user;gm(d,"isAnonymous",!1);b.aa(d);return c})};
  k.Ic=function(a,b){var c=this;return this.i.then(function(){return Xm(c,P(c.b,Ig,{email:a,password:b}))})};k.Xb=function(a,b){var c=this;return this.i.then(function(){return Xm(c,P(c.b,ej,{email:a,password:b}))})};k.Sa=function(a){var b=this;return this.i.then(function(){return Xm(b,a.na(b.b))})};k.Gc=function(a){Xe("firebase.auth.Auth.prototype.signInAndRetrieveDataWithCredential is deprecated. Please use firebase.auth.Auth.prototype.signInWithCredential instead.");return this.Sa(a)};
  k.ob=function(){var a=this;return this.i.then(function(){var b=U(a);if(b&&b.isAnonymous){var c=$e({providerId:null,isNewUser:!1});return $e({user:b,credential:null,additionalUserInfo:c,operationType:"signIn"})}return Xm(a,a.b.ob()).then(function(d){var e=d.user;gm(e,"isAnonymous",!0);a.aa(e);return d})})};function S(a){return a.app}function U(a){return a.currentUser}k.getUid=function(){return U(this)&&U(this).uid||null};function Zm(a){return U(a)&&U(a)._lat||null}
  function Vm(a){if(a.ga){for(var b=0;b<a.m.length;b++)if(a.m[b])a.m[b](Zm(a));if(a.W!==a.getUid()&&a.J.length)for(a.W=a.getUid(),b=0;b<a.J.length;b++)if(a.J[b])a.J[b](Zm(a));}}k.Wb=function(a){this.addAuthTokenListener(a);this.o++;0<this.o&&U(this)&&Xl(U(this));};k.Ec=function(a){var b=this;x(this.m,function(c){c==a&&b.o--;});0>this.o&&(this.o=0);0==this.o&&U(this)&&Yl(U(this));this.removeAuthTokenListener(a);};
  k.addAuthTokenListener=function(a){var b=this;this.m.push(a);T(this,this.i.then(function(){b.l||Na(b.m,a)&&a(Zm(b));}));};k.removeAuthTokenListener=function(a){Pa(this.m,function(b){return b==a});};function Ym(a,b){a.J.push(b);T(a,a.i.then(function(){!a.l&&Na(a.J,b)&&a.W!==a.getUid()&&(a.W=a.getUid(),b(Zm(a)));}));}
  k.delete=function(){this.l=!0;for(var a=0;a<this.O.length;a++)this.O[a].cancel("app-deleted");this.O=[];this.h&&(a=this.h,a.b.removeListener(Cm("local"),a.a,this.ma));this.a&&(ll(this.a,this),vl(this.a.b));return Promise.resolve()};function T(a,b){a.O.push(b);b.ka(function(){Oa(a.O,b);});return b}k.$b=function(a){return T(this,Ei(this.b,a))};k.qc=function(a){return !!Ng(a)};
  k.lb=function(a,b){var c=this;return T(this,D().then(function(){var d=new zf(b);if(!d.c)throw new M("argument-error",Hf+" must be true when sending sign in link to email");return Jf(d)}).then(function(d){return c.b.lb(a,d)}).then(function(){}))};k.Uc=function(a){return this.Ma(a).then(function(b){return b.data.email})};k.ab=function(a,b){return T(this,this.b.ab(a,b).then(function(){}))};k.Ma=function(a){return T(this,this.b.Ma(a).then(function(b){return new df(b)}))};
  k.Ya=function(a){return T(this,this.b.Ya(a).then(function(){}))};k.kb=function(a,b){var c=this;return T(this,D().then(function(){return "undefined"===typeof b||Ta(b)?{}:Jf(new zf(b))}).then(function(d){return c.b.kb(a,d)}).then(function(){}))};k.Kc=function(a,b){return T(this,Cl(this,a,b,t(this.Sa,this)))};
  k.Jc=function(a,b){var c=this;return T(this,D().then(function(){var d=b||he(),e=Mg(a,d);d=Ng(d);if(!d)throw new M("argument-error","Invalid email link!");if(d.tenantId!==c.R())throw new M("tenant-id-mismatch");return c.Sa(e)}))};function $m(){}$m.prototype.render=function(){};$m.prototype.reset=function(){};$m.prototype.getResponse=function(){};$m.prototype.execute=function(){};function an(){this.a={};this.b=1E12;}var bn=null;an.prototype.render=function(a,b){this.a[this.b.toString()]=new cn(a,b);return this.b++};an.prototype.reset=function(a){var b=dn(this,a);a=en(a);b&&a&&(b.delete(),delete this.a[a]);};an.prototype.getResponse=function(a){return (a=dn(this,a))?a.getResponse():null};an.prototype.execute=function(a){(a=dn(this,a))&&a.execute();};function dn(a,b){return (b=en(b))?a.a[b]||null:null}function en(a){return (a="undefined"===typeof a?1E12:a)?a.toString():null}
  function cn(a,b){this.g=!1;this.c=b;this.a=this.b=null;this.h="invisible"!==this.c.size;this.f=Vd(a);var c=this;this.i=function(){c.execute();};this.h?this.execute():Wc(this.f,"click",this.i);}cn.prototype.getResponse=function(){fn(this);return this.b};
  cn.prototype.execute=function(){fn(this);var a=this;this.a||(this.a=setTimeout(function(){a.b=Ce();var b=a.c.callback,c=a.c["expired-callback"];if(b)try{b(a.b);}catch(d){}a.a=setTimeout(function(){a.a=null;a.b=null;if(c)try{c();}catch(d){}a.h&&a.execute();},6E4);},500));};cn.prototype.delete=function(){fn(this);this.g=!0;clearTimeout(this.a);this.a=null;fd(this.f,"click",this.i);};function fn(a){if(a.g)throw Error("reCAPTCHA mock was already deleted!");}function gn(){}gn.prototype.g=function(){bn||(bn=new an);return D(bn)};gn.prototype.c=function(){};var hn=null;function jn(){this.b=l.grecaptcha?Infinity:0;this.f=null;this.a="__rcb"+Math.floor(1E6*Math.random()).toString();}var kn=new Xa(Ya,"https://www.google.com/recaptcha/api.js?onload=%{onload}&render=explicit&hl=%{hl}"),ln=new Pe(3E4,6E4);
  jn.prototype.g=function(a){var b=this;return new B(function(c,d){var e=setTimeout(function(){d(new M("network-request-failed"));},ln.get());if(!l.grecaptcha||a!==b.f&&!b.b){l[b.a]=function(){if(l.grecaptcha){b.f=a;var g=l.grecaptcha.render;l.grecaptcha.render=function(h,m){h=g(h,m);b.b++;return h};clearTimeout(e);c(l.grecaptcha);}else clearTimeout(e),d(new M("internal-error"));delete l[b.a];};var f=eb(kn,{onload:b.a,hl:a||""});D(gi(f)).s(function(){clearTimeout(e);d(new M("internal-error","Unable to load external reCAPTCHA dependencies!"));});}else clearTimeout(e),
  c(l.grecaptcha);})};jn.prototype.c=function(){this.b--;};var mn=null;function nn(a,b,c,d,e,f,g){K(this,"type","recaptcha");this.c=this.f=null;this.B=!1;this.u=b;this.g=null;g?(hn||(hn=new gn),g=hn):(mn||(mn=new jn),g=mn);this.m=g;this.a=c||{theme:"light",type:"image"};this.h=[];if(this.a[on])throw new M("argument-error","sitekey should not be provided for reCAPTCHA as one is automatically provisioned for the current project.");this.i="invisible"===this.a[pn];if(!l.document)throw new M("operation-not-supported-in-this-environment","RecaptchaVerifier is only supported in a browser HTTP/HTTPS environment with DOM support.");
  if(!Vd(b)||!this.i&&Vd(b).hasChildNodes())throw new M("argument-error","reCAPTCHA container is either not found or already contains inner elements!");this.o=new ni(a,f||null,e||null);this.v=d||function(){return null};var h=this;this.l=[];var m=this.a[qn];this.a[qn]=function(u){rn(h,u);if("function"===typeof m)m(u);else if("string"===typeof m){var A=J(m,l);"function"===typeof A&&A(u);}};var p=this.a[sn];this.a[sn]=function(){rn(h,null);if("function"===typeof p)p();else if("string"===typeof p){var u=
  J(p,l);"function"===typeof u&&u();}};}var qn="callback",sn="expired-callback",on="sitekey",pn="size";function rn(a,b){for(var c=0;c<a.l.length;c++)try{a.l[c](b);}catch(d){}}function tn(a,b){Pa(a.l,function(c){return c==b});}function un(a,b){a.h.push(b);b.ka(function(){Oa(a.h,b);});return b}k=nn.prototype;
  k.Da=function(){var a=this;return this.f?this.f:this.f=un(this,D().then(function(){if(Ie()&&!ze())return ue();throw new M("operation-not-supported-in-this-environment","RecaptchaVerifier is only supported in a browser HTTP/HTTPS environment.");}).then(function(){return a.m.g(a.v())}).then(function(b){a.g=b;return P(a.o,hj,{})}).then(function(b){a.a[on]=b.recaptchaSiteKey;}).s(function(b){a.f=null;throw b;}))};
  k.render=function(){vn(this);var a=this;return un(this,this.Da().then(function(){if(null===a.c){var b=a.u;if(!a.i){var c=Vd(b);b=Yd("DIV");c.appendChild(b);}a.c=a.g.render(b,a.a);}return a.c}))};k.verify=function(){vn(this);var a=this;return un(this,this.render().then(function(b){return new B(function(c){var d=a.g.getResponse(b);if(d)c(d);else{var e=function(f){f&&(tn(a,e),c(f));};a.l.push(e);a.i&&a.g.execute(a.c);}})}))};k.reset=function(){vn(this);null!==this.c&&this.g.reset(this.c);};
  function vn(a){if(a.B)throw new M("internal-error","RecaptchaVerifier instance has been destroyed.");}k.clear=function(){vn(this);this.B=!0;this.m.c();for(var a=0;a<this.h.length;a++)this.h[a].cancel("RecaptchaVerifier instance has been destroyed.");if(!this.i){a=Vd(this.u);for(var b;b=a.firstChild;)a.removeChild(b);}};
  function wn(a,b,c){var d=!1;try{this.b=c||firebase.app();}catch(g){throw new M("argument-error","No firebase.app.App instance is currently initialized.");}if(this.b.options&&this.b.options.apiKey)c=this.b.options.apiKey;else throw new M("invalid-api-key");var e=this,f=null;try{f=this.b.auth().Ca();}catch(g){}try{d=this.b.auth().settings.appVerificationDisabledForTesting;}catch(g){}f=firebase.SDK_VERSION?Ee(firebase.SDK_VERSION,f):null;nn.call(this,c,a,b,function(){try{var g=e.b.auth().ha();}catch(h){g=
  null;}return g},f,Uf(Vf),d);}v(wn,nn);function xn(a,b,c,d){a:{c=Array.prototype.slice.call(c);var e=0;for(var f=!1,g=0;g<b.length;g++)if(b[g].optional)f=!0;else{if(f)throw new M("internal-error","Argument validator encountered a required argument after an optional argument.");e++;}f=b.length;if(c.length<e||f<c.length)d="Expected "+(e==f?1==e?"1 argument":e+" arguments":e+"-"+f+" arguments")+" but got "+c.length+".";else{for(e=0;e<c.length;e++)if(f=b[e].optional&&void 0===c[e],!b[e].N(c[e])&&!f){b=b[e];if(0>e||e>=yn.length)throw new M("internal-error",
  "Argument validator received an unsupported number of arguments.");c=yn[e];d=(d?"":c+" argument ")+(b.name?'"'+b.name+'" ':"")+"must be "+b.M+".";break a}d=null;}}if(d)throw new M("argument-error",a+" failed: "+d);}var yn="First Second Third Fourth Fifth Sixth Seventh Eighth Ninth".split(" ");function V(a,b){return {name:a||"",M:"a valid string",optional:!!b,N:n}}function zn(a,b){return {name:a||"",M:"a boolean",optional:!!b,N:ha}}
  function W(a,b){return {name:a||"",M:"a valid object",optional:!!b,N:r}}function An(a,b){return {name:a||"",M:"a function",optional:!!b,N:q}}function Bn(a,b){return {name:a||"",M:"null",optional:!!b,N:ma}}function Cn(){return {name:"",M:"an HTML element",optional:!1,N:function(a){return !!(a&&a instanceof Element)}}}function Dn(){return {name:"auth",M:"an instance of Firebase Auth",optional:!0,N:function(a){return !!(a&&a instanceof Km)}}}
  function En(){return {name:"app",M:"an instance of Firebase App",optional:!0,N:function(a){return !!(a&&a instanceof firebase.app.App)}}}function Fn(a){return {name:a?a+"Credential":"credential",M:a?"a valid "+a+" credential":"a valid credential",optional:!1,N:function(b){if(!b)return !1;var c=!a||b.providerId===a;return !(!b.na||!c)}}}
  function Gn(){return {name:"authProvider",M:"a valid Auth provider",optional:!1,N:function(a){return !!(a&&a.providerId&&a.hasOwnProperty&&a.hasOwnProperty("isOAuthProvider"))}}}function Hn(){return {name:"applicationVerifier",M:"an implementation of firebase.auth.ApplicationVerifier",optional:!1,N:function(a){return !!(a&&n(a.type)&&q(a.verify))}}}function X(a,b,c,d){return {name:c||"",M:a.M+" or "+b.M,optional:!!d,N:function(e){return a.N(e)||b.N(e)}}}function Y(a,b){for(var c in b){var d=b[c].name;a[d]=In(d,a[c],b[c].j);}}function Jn(a,b){for(var c in b){var d=b[c].name;d!==c&&Object.defineProperty(a,d,{get:ta(function(e){return this[e]},c),set:ta(function(e,f,g,h){xn(e,[g],[h],!0);this[f]=h;},d,c,b[c].Za),enumerable:!0});}}function Z(a,b,c,d){a[b]=In(b,c,d);}
  function In(a,b,c){function d(){var g=Array.prototype.slice.call(arguments);xn(e,c,g);return b.apply(this,g)}if(!c)return b;var e=Kn(a),f;for(f in b)d[f]=b[f];for(f in b.prototype)d.prototype[f]=b.prototype[f];return d}function Kn(a){a=a.split(".");return a[a.length-1]}Y(Km.prototype,{Ya:{name:"applyActionCode",j:[V("code")]},Ma:{name:"checkActionCode",j:[V("code")]},ab:{name:"confirmPasswordReset",j:[V("code"),V("newPassword")]},Xb:{name:"createUserWithEmailAndPassword",j:[V("email"),V("password")]},$b:{name:"fetchSignInMethodsForEmail",j:[V("email")]},oa:{name:"getRedirectResult",j:[]},qc:{name:"isSignInWithEmailLink",j:[V("emailLink")]},wc:{name:"onAuthStateChanged",j:[X(W(),An(),"nextOrObserver"),An("opt_error",!0),An("opt_completed",!0)]},xc:{name:"onIdTokenChanged",
  j:[X(W(),An(),"nextOrObserver"),An("opt_error",!0),An("opt_completed",!0)]},kb:{name:"sendPasswordResetEmail",j:[V("email"),X(W("opt_actionCodeSettings",!0),Bn(null,!0),"opt_actionCodeSettings",!0)]},lb:{name:"sendSignInLinkToEmail",j:[V("email"),W("actionCodeSettings")]},mb:{name:"setPersistence",j:[V("persistence")]},Gc:{name:"signInAndRetrieveDataWithCredential",j:[Fn()]},ob:{name:"signInAnonymously",j:[]},Sa:{name:"signInWithCredential",j:[Fn()]},Hc:{name:"signInWithCustomToken",j:[V("token")]},
  Ic:{name:"signInWithEmailAndPassword",j:[V("email"),V("password")]},Jc:{name:"signInWithEmailLink",j:[V("email"),V("emailLink",!0)]},Kc:{name:"signInWithPhoneNumber",j:[V("phoneNumber"),Hn()]},Lc:{name:"signInWithPopup",j:[Gn()]},Mc:{name:"signInWithRedirect",j:[Gn()]},Rc:{name:"updateCurrentUser",j:[X(function(a){return {name:"user",M:"an instance of Firebase User",optional:!!a,N:function(b){return !!(b&&b instanceof Q)}}}(),Bn(),"user")]},pb:{name:"signOut",j:[]},toJSON:{name:"toJSON",j:[V(null,!0)]},
  Tc:{name:"useDeviceLanguage",j:[]},Uc:{name:"verifyPasswordResetCode",j:[V("code")]}});Jn(Km.prototype,{lc:{name:"languageCode",Za:X(V(),Bn(),"languageCode")},ti:{name:"tenantId",Za:X(V(),Bn(),"tenantId")}});Km.Persistence=nk;Km.Persistence.LOCAL="local";Km.Persistence.SESSION="session";Km.Persistence.NONE="none";
  Y(Q.prototype,{"delete":{name:"delete",j:[]},dc:{name:"getIdTokenResult",j:[zn("opt_forceRefresh",!0)]},G:{name:"getIdToken",j:[zn("opt_forceRefresh",!0)]},rc:{name:"linkAndRetrieveDataWithCredential",j:[Fn()]},fb:{name:"linkWithCredential",j:[Fn()]},sc:{name:"linkWithPhoneNumber",j:[V("phoneNumber"),Hn()]},tc:{name:"linkWithPopup",j:[Gn()]},uc:{name:"linkWithRedirect",j:[Gn()]},Ac:{name:"reauthenticateAndRetrieveDataWithCredential",j:[Fn()]},hb:{name:"reauthenticateWithCredential",j:[Fn()]},Bc:{name:"reauthenticateWithPhoneNumber",
  j:[V("phoneNumber"),Hn()]},Cc:{name:"reauthenticateWithPopup",j:[Gn()]},Dc:{name:"reauthenticateWithRedirect",j:[Gn()]},reload:{name:"reload",j:[]},jb:{name:"sendEmailVerification",j:[X(W("opt_actionCodeSettings",!0),Bn(null,!0),"opt_actionCodeSettings",!0)]},toJSON:{name:"toJSON",j:[V(null,!0)]},Qc:{name:"unlink",j:[V("provider")]},rb:{name:"updateEmail",j:[V("email")]},sb:{name:"updatePassword",j:[V("password")]},Sc:{name:"updatePhoneNumber",j:[Fn("phone")]},tb:{name:"updateProfile",j:[W("profile")]}});
  Y(an.prototype,{execute:{name:"execute"},render:{name:"render"},reset:{name:"reset"},getResponse:{name:"getResponse"}});Y($m.prototype,{execute:{name:"execute"},render:{name:"render"},reset:{name:"reset"},getResponse:{name:"getResponse"}});Y(B.prototype,{ka:{name:"finally"},s:{name:"catch"},then:{name:"then"}});Jn(Al.prototype,{appVerificationDisabled:{name:"appVerificationDisabledForTesting",Za:zn("appVerificationDisabledForTesting")}});Y(Bl.prototype,{confirm:{name:"confirm",j:[V("verificationCode")]}});
  Z(jg,"fromJSON",function(a){a=n(a)?JSON.parse(a):a;for(var b,c=[ug,Lg,Sg,rg],d=0;d<c.length;d++)if(b=c[d](a))return b;return null},[X(V(),W(),"json")]);Z(Gg,"credential",function(a,b){return new Fg(a,b)},[V("email"),V("password")]);Y(Fg.prototype,{A:{name:"toJSON",j:[V(null,!0)]}});Y(xg.prototype,{ya:{name:"addScope",j:[V("scope")]},Ga:{name:"setCustomParameters",j:[W("customOAuthParameters")]}});Z(xg,"credential",yg,[X(V(),W(),"token")]);Z(Gg,"credentialWithLink",Mg,[V("email"),V("emailLink")]);
  Y(zg.prototype,{ya:{name:"addScope",j:[V("scope")]},Ga:{name:"setCustomParameters",j:[W("customOAuthParameters")]}});Z(zg,"credential",Ag,[X(V(),W(),"token")]);Y(Bg.prototype,{ya:{name:"addScope",j:[V("scope")]},Ga:{name:"setCustomParameters",j:[W("customOAuthParameters")]}});Z(Bg,"credential",Cg,[X(V(),X(W(),Bn()),"idToken"),X(V(),Bn(),"accessToken",!0)]);Y(Dg.prototype,{Ga:{name:"setCustomParameters",j:[W("customOAuthParameters")]}});Z(Dg,"credential",Eg,[X(V(),W(),"token"),V("secret",!0)]);
  Y(O.prototype,{ya:{name:"addScope",j:[V("scope")]},credential:{name:"credential",j:[X(V(),X(W(),Bn()),"optionsOrIdToken"),X(V(),Bn(),"accessToken",!0)]},Ga:{name:"setCustomParameters",j:[W("customOAuthParameters")]}});Y(sg.prototype,{A:{name:"toJSON",j:[V(null,!0)]}});Y(mg.prototype,{A:{name:"toJSON",j:[V(null,!0)]}});Z(Tg,"credential",Vg,[V("verificationId"),V("verificationCode")]);Y(Tg.prototype,{Wa:{name:"verifyPhoneNumber",j:[V("phoneNumber"),Hn()]}});
  Y(Og.prototype,{A:{name:"toJSON",j:[V(null,!0)]}});Y(M.prototype,{toJSON:{name:"toJSON",j:[V(null,!0)]}});Y(dh.prototype,{toJSON:{name:"toJSON",j:[V(null,!0)]}});Y(ch.prototype,{toJSON:{name:"toJSON",j:[V(null,!0)]}});Y(wn.prototype,{clear:{name:"clear",j:[]},render:{name:"render",j:[]},verify:{name:"verify",j:[]}});Z(qf,"parseLink",yf,[V("link")]);
  (function(){if("undefined"!==typeof firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerComponent){var a={ActionCodeInfo:{Operation:{EMAIL_SIGNIN:hf,PASSWORD_RESET:"PASSWORD_RESET",RECOVER_EMAIL:"RECOVER_EMAIL",VERIFY_EMAIL:"VERIFY_EMAIL"}},Auth:Km,AuthCredential:jg,Error:M};Z(a,"EmailAuthProvider",Gg,[]);Z(a,"FacebookAuthProvider",xg,[]);Z(a,"GithubAuthProvider",zg,[]);Z(a,"GoogleAuthProvider",Bg,[]);Z(a,"TwitterAuthProvider",Dg,[]);Z(a,"OAuthProvider",O,[V("providerId")]);Z(a,"SAMLAuthProvider",
  wg,[V("providerId")]);Z(a,"PhoneAuthProvider",Tg,[Dn()]);Z(a,"RecaptchaVerifier",wn,[X(V(),Cn(),"recaptchaContainer"),W("recaptchaParameters",!0),En()]);Z(a,"ActionCodeURL",qf,[]);firebase.INTERNAL.registerComponent({name:"auth",instanceFactory:function(b){b=b.getProvider("app").getImmediate();return new Km(b)},multipleInstances:!1,serviceProps:a,instantiationMode:"LAZY",type:"PUBLIC"});firebase.INTERNAL.registerComponent({name:"auth-internal",instanceFactory:function(b){b=b.getProvider("auth").getImmediate();
  return {getUid:t(b.getUid,b),getToken:t(b.cc,b),addAuthTokenListener:t(b.Wb,b),removeAuthTokenListener:t(b.Ec,b)}},multipleInstances:!1,instantiationMode:"LAZY",type:"PRIVATE"});firebase.registerVersion("@firebase/auth","0.13.3");firebase.INTERNAL.extendNamespace({User:Q});}else throw Error("Cannot find the firebase namespace; be sure to include firebase-app.js before this library.");})();}).apply(typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : {});

  //# sourceMappingURL=auth.esm.js.map

  var firebaseConfig = {
      apiKey: "AIzaSyCTjnP1OP9ADtOgSUTOwxmNJDdN5dITTm0",
      authDomain: "ptone-serverless.firebaseapp.com",
      databaseURL: "https://ptone-serverless.firebaseio.com",
      projectId: "ptone-serverless",
      storageBucket: "ptone-serverless.appspot.com",
      messagingSenderId: "255222064158",
      appId: "1:255222064158:web:29c87c1f6c2efb8c"
  };
  console.log(index_cjs$3);
  index_cjs$3.initializeApp(firebaseConfig);
  const fireAuth = index_cjs$3.auth();
  const googleProvider = new index_cjs$3.auth.GoogleAuthProvider();

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  function isFunction(x) {
      return typeof x === 'function';
  }
  //# sourceMappingURL=isFunction.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  var _enable_super_gross_mode_that_will_cause_bad_things = false;
  var config = {
      Promise: undefined,
      set useDeprecatedSynchronousErrorHandling(value) {
          if (value) {
              var error = /*@__PURE__*/ new Error();
              /*@__PURE__*/ console.warn('DEPRECATED! RxJS was set to use deprecated synchronous error handling behavior by code at: \n' + error.stack);
          }
          _enable_super_gross_mode_that_will_cause_bad_things = value;
      },
      get useDeprecatedSynchronousErrorHandling() {
          return _enable_super_gross_mode_that_will_cause_bad_things;
      },
  };
  //# sourceMappingURL=config.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  function hostReportError(err) {
      setTimeout(function () { throw err; }, 0);
  }
  //# sourceMappingURL=hostReportError.js.map

  /** PURE_IMPORTS_START _config,_util_hostReportError PURE_IMPORTS_END */
  var empty$1 = {
      closed: true,
      next: function (value) { },
      error: function (err) {
          if (config.useDeprecatedSynchronousErrorHandling) {
              throw err;
          }
          else {
              hostReportError(err);
          }
      },
      complete: function () { }
  };
  //# sourceMappingURL=Observer.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  var isArray = /*@__PURE__*/ (function () { return Array.isArray || (function (x) { return x && typeof x.length === 'number'; }); })();
  //# sourceMappingURL=isArray.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  function isObject(x) {
      return x !== null && typeof x === 'object';
  }
  //# sourceMappingURL=isObject.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  var UnsubscriptionErrorImpl = /*@__PURE__*/ (function () {
      function UnsubscriptionErrorImpl(errors) {
          Error.call(this);
          this.message = errors ?
              errors.length + " errors occurred during unsubscription:\n" + errors.map(function (err, i) { return i + 1 + ") " + err.toString(); }).join('\n  ') : '';
          this.name = 'UnsubscriptionError';
          this.errors = errors;
          return this;
      }
      UnsubscriptionErrorImpl.prototype = /*@__PURE__*/ Object.create(Error.prototype);
      return UnsubscriptionErrorImpl;
  })();
  var UnsubscriptionError = UnsubscriptionErrorImpl;
  //# sourceMappingURL=UnsubscriptionError.js.map

  /** PURE_IMPORTS_START _util_isArray,_util_isObject,_util_isFunction,_util_UnsubscriptionError PURE_IMPORTS_END */
  var Subscription = /*@__PURE__*/ (function () {
      function Subscription(unsubscribe) {
          this.closed = false;
          this._parentOrParents = null;
          this._subscriptions = null;
          if (unsubscribe) {
              this._unsubscribe = unsubscribe;
          }
      }
      Subscription.prototype.unsubscribe = function () {
          var errors;
          if (this.closed) {
              return;
          }
          var _a = this, _parentOrParents = _a._parentOrParents, _unsubscribe = _a._unsubscribe, _subscriptions = _a._subscriptions;
          this.closed = true;
          this._parentOrParents = null;
          this._subscriptions = null;
          if (_parentOrParents instanceof Subscription) {
              _parentOrParents.remove(this);
          }
          else if (_parentOrParents !== null) {
              for (var index = 0; index < _parentOrParents.length; ++index) {
                  var parent_1 = _parentOrParents[index];
                  parent_1.remove(this);
              }
          }
          if (isFunction(_unsubscribe)) {
              try {
                  _unsubscribe.call(this);
              }
              catch (e) {
                  errors = e instanceof UnsubscriptionError ? flattenUnsubscriptionErrors(e.errors) : [e];
              }
          }
          if (isArray(_subscriptions)) {
              var index = -1;
              var len = _subscriptions.length;
              while (++index < len) {
                  var sub = _subscriptions[index];
                  if (isObject(sub)) {
                      try {
                          sub.unsubscribe();
                      }
                      catch (e) {
                          errors = errors || [];
                          if (e instanceof UnsubscriptionError) {
                              errors = errors.concat(flattenUnsubscriptionErrors(e.errors));
                          }
                          else {
                              errors.push(e);
                          }
                      }
                  }
              }
          }
          if (errors) {
              throw new UnsubscriptionError(errors);
          }
      };
      Subscription.prototype.add = function (teardown) {
          var subscription = teardown;
          if (!teardown) {
              return Subscription.EMPTY;
          }
          switch (typeof teardown) {
              case 'function':
                  subscription = new Subscription(teardown);
              case 'object':
                  if (subscription === this || subscription.closed || typeof subscription.unsubscribe !== 'function') {
                      return subscription;
                  }
                  else if (this.closed) {
                      subscription.unsubscribe();
                      return subscription;
                  }
                  else if (!(subscription instanceof Subscription)) {
                      var tmp = subscription;
                      subscription = new Subscription();
                      subscription._subscriptions = [tmp];
                  }
                  break;
              default: {
                  throw new Error('unrecognized teardown ' + teardown + ' added to Subscription.');
              }
          }
          var _parentOrParents = subscription._parentOrParents;
          if (_parentOrParents === null) {
              subscription._parentOrParents = this;
          }
          else if (_parentOrParents instanceof Subscription) {
              if (_parentOrParents === this) {
                  return subscription;
              }
              subscription._parentOrParents = [_parentOrParents, this];
          }
          else if (_parentOrParents.indexOf(this) === -1) {
              _parentOrParents.push(this);
          }
          else {
              return subscription;
          }
          var subscriptions = this._subscriptions;
          if (subscriptions === null) {
              this._subscriptions = [subscription];
          }
          else {
              subscriptions.push(subscription);
          }
          return subscription;
      };
      Subscription.prototype.remove = function (subscription) {
          var subscriptions = this._subscriptions;
          if (subscriptions) {
              var subscriptionIndex = subscriptions.indexOf(subscription);
              if (subscriptionIndex !== -1) {
                  subscriptions.splice(subscriptionIndex, 1);
              }
          }
      };
      Subscription.EMPTY = (function (empty) {
          empty.closed = true;
          return empty;
      }(new Subscription()));
      return Subscription;
  }());
  function flattenUnsubscriptionErrors(errors) {
      return errors.reduce(function (errs, err) { return errs.concat((err instanceof UnsubscriptionError) ? err.errors : err); }, []);
  }
  //# sourceMappingURL=Subscription.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  var rxSubscriber = /*@__PURE__*/ (function () {
      return typeof Symbol === 'function'
          ? /*@__PURE__*/ Symbol('rxSubscriber')
          : '@@rxSubscriber_' + /*@__PURE__*/ Math.random();
  })();
  //# sourceMappingURL=rxSubscriber.js.map

  /** PURE_IMPORTS_START tslib,_util_isFunction,_Observer,_Subscription,_internal_symbol_rxSubscriber,_config,_util_hostReportError PURE_IMPORTS_END */
  var Subscriber = /*@__PURE__*/ (function (_super) {
      __extends(Subscriber, _super);
      function Subscriber(destinationOrNext, error, complete) {
          var _this = _super.call(this) || this;
          _this.syncErrorValue = null;
          _this.syncErrorThrown = false;
          _this.syncErrorThrowable = false;
          _this.isStopped = false;
          switch (arguments.length) {
              case 0:
                  _this.destination = empty$1;
                  break;
              case 1:
                  if (!destinationOrNext) {
                      _this.destination = empty$1;
                      break;
                  }
                  if (typeof destinationOrNext === 'object') {
                      if (destinationOrNext instanceof Subscriber) {
                          _this.syncErrorThrowable = destinationOrNext.syncErrorThrowable;
                          _this.destination = destinationOrNext;
                          destinationOrNext.add(_this);
                      }
                      else {
                          _this.syncErrorThrowable = true;
                          _this.destination = new SafeSubscriber(_this, destinationOrNext);
                      }
                      break;
                  }
              default:
                  _this.syncErrorThrowable = true;
                  _this.destination = new SafeSubscriber(_this, destinationOrNext, error, complete);
                  break;
          }
          return _this;
      }
      Subscriber.prototype[rxSubscriber] = function () { return this; };
      Subscriber.create = function (next, error, complete) {
          var subscriber = new Subscriber(next, error, complete);
          subscriber.syncErrorThrowable = false;
          return subscriber;
      };
      Subscriber.prototype.next = function (value) {
          if (!this.isStopped) {
              this._next(value);
          }
      };
      Subscriber.prototype.error = function (err) {
          if (!this.isStopped) {
              this.isStopped = true;
              this._error(err);
          }
      };
      Subscriber.prototype.complete = function () {
          if (!this.isStopped) {
              this.isStopped = true;
              this._complete();
          }
      };
      Subscriber.prototype.unsubscribe = function () {
          if (this.closed) {
              return;
          }
          this.isStopped = true;
          _super.prototype.unsubscribe.call(this);
      };
      Subscriber.prototype._next = function (value) {
          this.destination.next(value);
      };
      Subscriber.prototype._error = function (err) {
          this.destination.error(err);
          this.unsubscribe();
      };
      Subscriber.prototype._complete = function () {
          this.destination.complete();
          this.unsubscribe();
      };
      Subscriber.prototype._unsubscribeAndRecycle = function () {
          var _parentOrParents = this._parentOrParents;
          this._parentOrParents = null;
          this.unsubscribe();
          this.closed = false;
          this.isStopped = false;
          this._parentOrParents = _parentOrParents;
          return this;
      };
      return Subscriber;
  }(Subscription));
  var SafeSubscriber = /*@__PURE__*/ (function (_super) {
      __extends(SafeSubscriber, _super);
      function SafeSubscriber(_parentSubscriber, observerOrNext, error, complete) {
          var _this = _super.call(this) || this;
          _this._parentSubscriber = _parentSubscriber;
          var next;
          var context = _this;
          if (isFunction(observerOrNext)) {
              next = observerOrNext;
          }
          else if (observerOrNext) {
              next = observerOrNext.next;
              error = observerOrNext.error;
              complete = observerOrNext.complete;
              if (observerOrNext !== empty$1) {
                  context = Object.create(observerOrNext);
                  if (isFunction(context.unsubscribe)) {
                      _this.add(context.unsubscribe.bind(context));
                  }
                  context.unsubscribe = _this.unsubscribe.bind(_this);
              }
          }
          _this._context = context;
          _this._next = next;
          _this._error = error;
          _this._complete = complete;
          return _this;
      }
      SafeSubscriber.prototype.next = function (value) {
          if (!this.isStopped && this._next) {
              var _parentSubscriber = this._parentSubscriber;
              if (!config.useDeprecatedSynchronousErrorHandling || !_parentSubscriber.syncErrorThrowable) {
                  this.__tryOrUnsub(this._next, value);
              }
              else if (this.__tryOrSetError(_parentSubscriber, this._next, value)) {
                  this.unsubscribe();
              }
          }
      };
      SafeSubscriber.prototype.error = function (err) {
          if (!this.isStopped) {
              var _parentSubscriber = this._parentSubscriber;
              var useDeprecatedSynchronousErrorHandling = config.useDeprecatedSynchronousErrorHandling;
              if (this._error) {
                  if (!useDeprecatedSynchronousErrorHandling || !_parentSubscriber.syncErrorThrowable) {
                      this.__tryOrUnsub(this._error, err);
                      this.unsubscribe();
                  }
                  else {
                      this.__tryOrSetError(_parentSubscriber, this._error, err);
                      this.unsubscribe();
                  }
              }
              else if (!_parentSubscriber.syncErrorThrowable) {
                  this.unsubscribe();
                  if (useDeprecatedSynchronousErrorHandling) {
                      throw err;
                  }
                  hostReportError(err);
              }
              else {
                  if (useDeprecatedSynchronousErrorHandling) {
                      _parentSubscriber.syncErrorValue = err;
                      _parentSubscriber.syncErrorThrown = true;
                  }
                  else {
                      hostReportError(err);
                  }
                  this.unsubscribe();
              }
          }
      };
      SafeSubscriber.prototype.complete = function () {
          var _this = this;
          if (!this.isStopped) {
              var _parentSubscriber = this._parentSubscriber;
              if (this._complete) {
                  var wrappedComplete = function () { return _this._complete.call(_this._context); };
                  if (!config.useDeprecatedSynchronousErrorHandling || !_parentSubscriber.syncErrorThrowable) {
                      this.__tryOrUnsub(wrappedComplete);
                      this.unsubscribe();
                  }
                  else {
                      this.__tryOrSetError(_parentSubscriber, wrappedComplete);
                      this.unsubscribe();
                  }
              }
              else {
                  this.unsubscribe();
              }
          }
      };
      SafeSubscriber.prototype.__tryOrUnsub = function (fn, value) {
          try {
              fn.call(this._context, value);
          }
          catch (err) {
              this.unsubscribe();
              if (config.useDeprecatedSynchronousErrorHandling) {
                  throw err;
              }
              else {
                  hostReportError(err);
              }
          }
      };
      SafeSubscriber.prototype.__tryOrSetError = function (parent, fn, value) {
          if (!config.useDeprecatedSynchronousErrorHandling) {
              throw new Error('bad call');
          }
          try {
              fn.call(this._context, value);
          }
          catch (err) {
              if (config.useDeprecatedSynchronousErrorHandling) {
                  parent.syncErrorValue = err;
                  parent.syncErrorThrown = true;
                  return true;
              }
              else {
                  hostReportError(err);
                  return true;
              }
          }
          return false;
      };
      SafeSubscriber.prototype._unsubscribe = function () {
          var _parentSubscriber = this._parentSubscriber;
          this._context = null;
          this._parentSubscriber = null;
          _parentSubscriber.unsubscribe();
      };
      return SafeSubscriber;
  }(Subscriber));
  //# sourceMappingURL=Subscriber.js.map

  /** PURE_IMPORTS_START _Subscriber PURE_IMPORTS_END */
  function canReportError(observer) {
      while (observer) {
          var _a = observer, closed_1 = _a.closed, destination = _a.destination, isStopped = _a.isStopped;
          if (closed_1 || isStopped) {
              return false;
          }
          else if (destination && destination instanceof Subscriber) {
              observer = destination;
          }
          else {
              observer = null;
          }
      }
      return true;
  }
  //# sourceMappingURL=canReportError.js.map

  /** PURE_IMPORTS_START _Subscriber,_symbol_rxSubscriber,_Observer PURE_IMPORTS_END */
  function toSubscriber(nextOrObserver, error, complete) {
      if (nextOrObserver) {
          if (nextOrObserver instanceof Subscriber) {
              return nextOrObserver;
          }
          if (nextOrObserver[rxSubscriber]) {
              return nextOrObserver[rxSubscriber]();
          }
      }
      if (!nextOrObserver && !error && !complete) {
          return new Subscriber(empty$1);
      }
      return new Subscriber(nextOrObserver, error, complete);
  }
  //# sourceMappingURL=toSubscriber.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  var observable = /*@__PURE__*/ (function () { return typeof Symbol === 'function' && Symbol.observable || '@@observable'; })();
  //# sourceMappingURL=observable.js.map

  /** PURE_IMPORTS_START  PURE_IMPORTS_END */
  function noop$1() { }
  //# sourceMappingURL=noop.js.map

  /** PURE_IMPORTS_START _noop PURE_IMPORTS_END */
  function pipeFromArray(fns) {
      if (!fns) {
          return noop$1;
      }
      if (fns.length === 1) {
          return fns[0];
      }
      return function piped(input) {
          return fns.reduce(function (prev, fn) { return fn(prev); }, input);
      };
  }
  //# sourceMappingURL=pipe.js.map

  /** PURE_IMPORTS_START _util_canReportError,_util_toSubscriber,_symbol_observable,_util_pipe,_config PURE_IMPORTS_END */
  var Observable = /*@__PURE__*/ (function () {
      function Observable(subscribe) {
          this._isScalar = false;
          if (subscribe) {
              this._subscribe = subscribe;
          }
      }
      Observable.prototype.lift = function (operator) {
          var observable = new Observable();
          observable.source = this;
          observable.operator = operator;
          return observable;
      };
      Observable.prototype.subscribe = function (observerOrNext, error, complete) {
          var operator = this.operator;
          var sink = toSubscriber(observerOrNext, error, complete);
          if (operator) {
              sink.add(operator.call(sink, this.source));
          }
          else {
              sink.add(this.source || (config.useDeprecatedSynchronousErrorHandling && !sink.syncErrorThrowable) ?
                  this._subscribe(sink) :
                  this._trySubscribe(sink));
          }
          if (config.useDeprecatedSynchronousErrorHandling) {
              if (sink.syncErrorThrowable) {
                  sink.syncErrorThrowable = false;
                  if (sink.syncErrorThrown) {
                      throw sink.syncErrorValue;
                  }
              }
          }
          return sink;
      };
      Observable.prototype._trySubscribe = function (sink) {
          try {
              return this._subscribe(sink);
          }
          catch (err) {
              if (config.useDeprecatedSynchronousErrorHandling) {
                  sink.syncErrorThrown = true;
                  sink.syncErrorValue = err;
              }
              if (canReportError(sink)) {
                  sink.error(err);
              }
              else {
                  console.warn(err);
              }
          }
      };
      Observable.prototype.forEach = function (next, promiseCtor) {
          var _this = this;
          promiseCtor = getPromiseCtor(promiseCtor);
          return new promiseCtor(function (resolve, reject) {
              var subscription;
              subscription = _this.subscribe(function (value) {
                  try {
                      next(value);
                  }
                  catch (err) {
                      reject(err);
                      if (subscription) {
                          subscription.unsubscribe();
                      }
                  }
              }, reject, resolve);
          });
      };
      Observable.prototype._subscribe = function (subscriber) {
          var source = this.source;
          return source && source.subscribe(subscriber);
      };
      Observable.prototype[observable] = function () {
          return this;
      };
      Observable.prototype.pipe = function () {
          var operations = [];
          for (var _i = 0; _i < arguments.length; _i++) {
              operations[_i] = arguments[_i];
          }
          if (operations.length === 0) {
              return this;
          }
          return pipeFromArray(operations)(this);
      };
      Observable.prototype.toPromise = function (promiseCtor) {
          var _this = this;
          promiseCtor = getPromiseCtor(promiseCtor);
          return new promiseCtor(function (resolve, reject) {
              var value;
              _this.subscribe(function (x) { return value = x; }, function (err) { return reject(err); }, function () { return resolve(value); });
          });
      };
      Observable.create = function (subscribe) {
          return new Observable(subscribe);
      };
      return Observable;
  }());
  function getPromiseCtor(promiseCtor) {
      if (!promiseCtor) {
          promiseCtor =  Promise;
      }
      if (!promiseCtor) {
          throw new Error('no Promise impl found');
      }
      return promiseCtor;
  }
  //# sourceMappingURL=Observable.js.map

  /**
   * @license
   * Copyright 2018 Google Inc.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
  /**
   * Create an observable of authentication state. The observer is only
   * triggered on sign-in or sign-out.
   * @param auth firebase.auth.Auth
   */
  function authState(auth) {
      return new Observable(function (subscriber) {
          var unsubscribe = auth.onAuthStateChanged(subscriber);
          return { unsubscribe: unsubscribe };
      });
  }
  //# sourceMappingURL=index.esm.js.map

  // const uu: firebase.User = new(firebase.User)
  const user = writable({});
  const unsubscribe = authState(fireAuth).subscribe(u => {
      console.log(u);
      user.set(u);
  });

  /* src/Login.svelte generated by Svelte v3.16.7 */

  // (25:0) {:else}
  function create_else_block$4(ctx) {
  	let current;

  	const item = new Item({
  			props: {
  				$$slots: { default: [create_default_slot_2$1] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item.$on("click", login);

  	const block = {
  		c: function create() {
  			create_component(item.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(item, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const item_changes = {};

  			if (dirty & /*$$scope*/ 4) {
  				item_changes.$$scope = { dirty, ctx };
  			}

  			item.$set(item_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(item.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(item.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(item, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_else_block$4.name,
  		type: "else",
  		source: "(25:0) {:else}",
  		ctx
  	});

  	return block;
  }

  // (20:0) {#if $user}
  function create_if_block$4(ctx) {
  	let current;

  	const item = new Item({
  			props: {
  				$$slots: { default: [create_default_slot$3] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item.$on("click", /*click_handler*/ ctx[1]);

  	const block = {
  		c: function create() {
  			create_component(item.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(item, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const item_changes = {};

  			if (dirty & /*$$scope*/ 4) {
  				item_changes.$$scope = { dirty, ctx };
  			}

  			item.$set(item_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(item.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(item.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(item, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_if_block$4.name,
  		type: "if",
  		source: "(20:0) {#if $user}",
  		ctx
  	});

  	return block;
  }

  // (27:6) <Text>
  function create_default_slot_3(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Signin with Google");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_3.name,
  		type: "slot",
  		source: "(27:6) <Text>",
  		ctx
  	});

  	return block;
  }

  // (26:2) <Item on:click={ login } >
  function create_default_slot_2$1(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_3] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_2$1.name,
  		type: "slot",
  		source: "(26:2) <Item on:click={ login } >",
  		ctx
  	});

  	return block;
  }

  // (23:6) <Text>
  function create_default_slot_1$1(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Logout");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_1$1.name,
  		type: "slot",
  		source: "(23:6) <Text>",
  		ctx
  	});

  	return block;
  }

  // (22:4) <Item on:click={ () => fireAuth.signOut() } >
  function create_default_slot$3(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_1$1] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$3.name,
  		type: "slot",
  		source: "(22:4) <Item on:click={ () => fireAuth.signOut() } >",
  		ctx
  	});

  	return block;
  }

  function create_fragment$h(ctx) {
  	let current_block_type_index;
  	let if_block;
  	let if_block_anchor;
  	let current;
  	const if_block_creators = [create_if_block$4, create_else_block$4];
  	const if_blocks = [];

  	function select_block_type(ctx, dirty) {
  		if (/*$user*/ ctx[0]) return 0;
  		return 1;
  	}

  	current_block_type_index = select_block_type(ctx);
  	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

  	const block = {
  		c: function create() {
  			if_block.c();
  			if_block_anchor = empty();
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			if_blocks[current_block_type_index].m(target, anchor);
  			insert_dev(target, if_block_anchor, anchor);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			let previous_block_index = current_block_type_index;
  			current_block_type_index = select_block_type(ctx);

  			if (current_block_type_index === previous_block_index) {
  				if_blocks[current_block_type_index].p(ctx, dirty);
  			} else {
  				group_outros();

  				transition_out(if_blocks[previous_block_index], 1, 1, () => {
  					if_blocks[previous_block_index] = null;
  				});

  				check_outros();
  				if_block = if_blocks[current_block_type_index];

  				if (!if_block) {
  					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
  					if_block.c();
  				}

  				transition_in(if_block, 1);
  				if_block.m(if_block_anchor.parentNode, if_block_anchor);
  			}
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(if_block);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(if_block);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if_blocks[current_block_type_index].d(detaching);
  			if (detaching) detach_dev(if_block_anchor);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$h.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function login() {
  	fireAuth.signInWithPopup(googleProvider);
  }

  function instance$h($$self, $$props, $$invalidate) {
  	let $user;
  	validate_store(user, "user");
  	component_subscribe($$self, user, $$value => $$invalidate(0, $user = $$value));
  	const click_handler = () => fireAuth.signOut();

  	$$self.$capture_state = () => {
  		return {};
  	};

  	$$self.$inject_state = $$props => {
  		if ("$user" in $$props) user.set($user = $$props.$user);
  	};

  	return [$user, click_handler];
  }

  class Login extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$h, create_fragment$h, safe_not_equal, {});

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Login",
  			options,
  			id: create_fragment$h.name
  		});
  	}
  }

  /* src/Profile.svelte generated by Svelte v3.16.7 */

  const file$f = "src/Profile.svelte";

  function create_fragment$i(ctx) {
  	let h3;
  	let t0;
  	let t1;
  	let t2;
  	let t3;
  	let img;
  	let img_src_value;
  	let t4;
  	let p;
  	let t5;
  	let t6;

  	const block = {
  		c: function create() {
  			h3 = element("h3");
  			t0 = text("Hi ");
  			t1 = text(/*displayName*/ ctx[0]);
  			t2 = text("!");
  			t3 = space();
  			img = element("img");
  			t4 = space();
  			p = element("p");
  			t5 = text("Your userID is ");
  			t6 = text(/*uid*/ ctx[2]);
  			add_location(h3, file$f, 7, 0, 94);
  			if (img.src !== (img_src_value = /*photoURL*/ ctx[1])) attr_dev(img, "src", img_src_value);
  			attr_dev(img, "width", "100");
  			attr_dev(img, "alt", "user avatar");
  			add_location(img, file$f, 9, 0, 124);
  			add_location(p, file$f, 10, 0, 177);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, h3, anchor);
  			append_dev(h3, t0);
  			append_dev(h3, t1);
  			append_dev(h3, t2);
  			insert_dev(target, t3, anchor);
  			insert_dev(target, img, anchor);
  			insert_dev(target, t4, anchor);
  			insert_dev(target, p, anchor);
  			append_dev(p, t5);
  			append_dev(p, t6);
  		},
  		p: function update(ctx, [dirty]) {
  			if (dirty & /*displayName*/ 1) set_data_dev(t1, /*displayName*/ ctx[0]);

  			if (dirty & /*photoURL*/ 2 && img.src !== (img_src_value = /*photoURL*/ ctx[1])) {
  				attr_dev(img, "src", img_src_value);
  			}

  			if (dirty & /*uid*/ 4) set_data_dev(t6, /*uid*/ ctx[2]);
  		},
  		i: noop,
  		o: noop,
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(h3);
  			if (detaching) detach_dev(t3);
  			if (detaching) detach_dev(img);
  			if (detaching) detach_dev(t4);
  			if (detaching) detach_dev(p);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$i.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$i($$self, $$props, $$invalidate) {
  	let { displayName } = $$props;
  	let { photoURL } = $$props;
  	let { uid } = $$props;
  	const writable_props = ["displayName", "photoURL", "uid"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Profile> was created with unknown prop '${key}'`);
  	});

  	$$self.$set = $$props => {
  		if ("displayName" in $$props) $$invalidate(0, displayName = $$props.displayName);
  		if ("photoURL" in $$props) $$invalidate(1, photoURL = $$props.photoURL);
  		if ("uid" in $$props) $$invalidate(2, uid = $$props.uid);
  	};

  	$$self.$capture_state = () => {
  		return { displayName, photoURL, uid };
  	};

  	$$self.$inject_state = $$props => {
  		if ("displayName" in $$props) $$invalidate(0, displayName = $$props.displayName);
  		if ("photoURL" in $$props) $$invalidate(1, photoURL = $$props.photoURL);
  		if ("uid" in $$props) $$invalidate(2, uid = $$props.uid);
  	};

  	return [displayName, photoURL, uid];
  }

  class Profile extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$i, create_fragment$i, safe_not_equal, { displayName: 0, photoURL: 1, uid: 2 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "Profile",
  			options,
  			id: create_fragment$i.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (/*displayName*/ ctx[0] === undefined && !("displayName" in props)) {
  			console.warn("<Profile> was created without expected prop 'displayName'");
  		}

  		if (/*photoURL*/ ctx[1] === undefined && !("photoURL" in props)) {
  			console.warn("<Profile> was created without expected prop 'photoURL'");
  		}

  		if (/*uid*/ ctx[2] === undefined && !("uid" in props)) {
  			console.warn("<Profile> was created without expected prop 'uid'");
  		}
  	}

  	get displayName() {
  		throw new Error("<Profile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set displayName(value) {
  		throw new Error("<Profile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get photoURL() {
  		throw new Error("<Profile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set photoURL(value) {
  		throw new Error("<Profile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	get uid() {
  		throw new Error("<Profile>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set uid(value) {
  		throw new Error("<Profile>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  /* src/App.svelte generated by Svelte v3.16.7 */

  const { console: console_1 } = globals;
  const file$g = "src/App.svelte";

  // (35:6) <IconButton class="material-icons" on:click={() => myDrawerOpen = !myDrawerOpen}>
  function create_default_slot_29(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("menu");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_29.name,
  		type: "slot",
  		source: "(35:6) <IconButton class=\\\"material-icons\\\" on:click={() => myDrawerOpen = !myDrawerOpen}>",
  		ctx
  	});

  	return block;
  }

  // (36:6) <Title>
  function create_default_slot_28(ctx) {
  	let t0;
  	let t1;

  	const block = {
  		c: function create() {
  			t0 = text(/*name*/ ctx[0]);
  			t1 = text(" API Demo");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t0, anchor);
  			insert_dev(target, t1, anchor);
  		},
  		p: function update(ctx, dirty) {
  			if (dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t0);
  			if (detaching) detach_dev(t1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_28.name,
  		type: "slot",
  		source: "(36:6) <Title>",
  		ctx
  	});

  	return block;
  }

  // (34:4) <Section>
  function create_default_slot_27(ctx) {
  	let t;
  	let current;

  	const iconbutton = new IconButton({
  			props: {
  				class: "material-icons",
  				$$slots: { default: [create_default_slot_29] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	iconbutton.$on("click", /*click_handler*/ ctx[10]);

  	const title = new Title({
  			props: {
  				$$slots: { default: [create_default_slot_28] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(iconbutton.$$.fragment);
  			t = space();
  			create_component(title.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(iconbutton, target, anchor);
  			insert_dev(target, t, anchor);
  			mount_component(title, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const iconbutton_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				iconbutton_changes.$$scope = { dirty, ctx };
  			}

  			iconbutton.$set(iconbutton_changes);
  			const title_changes = {};

  			if (dirty & /*$$scope, name*/ 4194305) {
  				title_changes.$$scope = { dirty, ctx };
  			}

  			title.$set(title_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(iconbutton.$$.fragment, local);
  			transition_in(title.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(iconbutton.$$.fragment, local);
  			transition_out(title.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(iconbutton, detaching);
  			if (detaching) detach_dev(t);
  			destroy_component(title, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_27.name,
  		type: "slot",
  		source: "(34:4) <Section>",
  		ctx
  	});

  	return block;
  }

  // (39:6) <IconButton class="material-icons" aria-label="Download">
  function create_default_slot_26(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("file_download");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_26.name,
  		type: "slot",
  		source: "(39:6) <IconButton class=\\\"material-icons\\\" aria-label=\\\"Download\\\">",
  		ctx
  	});

  	return block;
  }

  // (40:6) <IconButton class="material-icons" aria-label="Print this page">
  function create_default_slot_25(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("print");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_25.name,
  		type: "slot",
  		source: "(40:6) <IconButton class=\\\"material-icons\\\" aria-label=\\\"Print this page\\\">",
  		ctx
  	});

  	return block;
  }

  // (42:6) <IconButton class="material-icons menu-toggle-button" aria-label="User" on:click={() => menu.setOpen(true)}>
  function create_default_slot_24(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("account_circle");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_24.name,
  		type: "slot",
  		source: "(42:6) <IconButton class=\\\"material-icons menu-toggle-button\\\" aria-label=\\\"User\\\" on:click={() => menu.setOpen(true)}>",
  		ctx
  	});

  	return block;
  }

  // (44:8) <List>
  function create_default_slot_23(ctx) {
  	let current;
  	const login = new Login({ $$inline: true });

  	const block = {
  		c: function create() {
  			create_component(login.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(login, target, anchor);
  			current = true;
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(login.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(login.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(login, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_23.name,
  		type: "slot",
  		source: "(44:8) <List>",
  		ctx
  	});

  	return block;
  }

  // (43:6) <Menu bind:this={menu} anchorCorner="BOTTOM_LEFT">
  function create_default_slot_22(ctx) {
  	let current;

  	const list = new List({
  			props: {
  				$$slots: { default: [create_default_slot_23] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(list.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(list, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const list_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				list_changes.$$scope = { dirty, ctx };
  			}

  			list.$set(list_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(list.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(list.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(list, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_22.name,
  		type: "slot",
  		source: "(43:6) <Menu bind:this={menu} anchorCorner=\\\"BOTTOM_LEFT\\\">",
  		ctx
  	});

  	return block;
  }

  // (38:4) <Section align="end" toolbar>
  function create_default_slot_21(ctx) {
  	let t0;
  	let t1;
  	let div;
  	let t2;
  	let current;

  	const iconbutton0 = new IconButton({
  			props: {
  				class: "material-icons",
  				"aria-label": "Download",
  				$$slots: { default: [create_default_slot_26] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const iconbutton1 = new IconButton({
  			props: {
  				class: "material-icons",
  				"aria-label": "Print this page",
  				$$slots: { default: [create_default_slot_25] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const iconbutton2 = new IconButton({
  			props: {
  				class: "material-icons menu-toggle-button",
  				"aria-label": "User",
  				$$slots: { default: [create_default_slot_24] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	iconbutton2.$on("click", /*click_handler_1*/ ctx[11]);

  	let menu_1_props = {
  		anchorCorner: "BOTTOM_LEFT",
  		$$slots: { default: [create_default_slot_22] },
  		$$scope: { ctx }
  	};

  	const menu_1 = new Menu({ props: menu_1_props, $$inline: true });
  	/*menu_1_binding*/ ctx[12](menu_1);

  	const block = {
  		c: function create() {
  			create_component(iconbutton0.$$.fragment);
  			t0 = space();
  			create_component(iconbutton1.$$.fragment);
  			t1 = space();
  			div = element("div");
  			create_component(iconbutton2.$$.fragment);
  			t2 = space();
  			create_component(menu_1.$$.fragment);
  			add_location(div, file$g, 40, 6, 1402);
  		},
  		m: function mount(target, anchor) {
  			mount_component(iconbutton0, target, anchor);
  			insert_dev(target, t0, anchor);
  			mount_component(iconbutton1, target, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, div, anchor);
  			mount_component(iconbutton2, div, null);
  			append_dev(div, t2);
  			mount_component(menu_1, div, null);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const iconbutton0_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				iconbutton0_changes.$$scope = { dirty, ctx };
  			}

  			iconbutton0.$set(iconbutton0_changes);
  			const iconbutton1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				iconbutton1_changes.$$scope = { dirty, ctx };
  			}

  			iconbutton1.$set(iconbutton1_changes);
  			const iconbutton2_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				iconbutton2_changes.$$scope = { dirty, ctx };
  			}

  			iconbutton2.$set(iconbutton2_changes);
  			const menu_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				menu_1_changes.$$scope = { dirty, ctx };
  			}

  			menu_1.$set(menu_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(iconbutton0.$$.fragment, local);
  			transition_in(iconbutton1.$$.fragment, local);
  			transition_in(iconbutton2.$$.fragment, local);
  			transition_in(menu_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(iconbutton0.$$.fragment, local);
  			transition_out(iconbutton1.$$.fragment, local);
  			transition_out(iconbutton2.$$.fragment, local);
  			transition_out(menu_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(iconbutton0, detaching);
  			if (detaching) detach_dev(t0);
  			destroy_component(iconbutton1, detaching);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(div);
  			destroy_component(iconbutton2);
  			/*menu_1_binding*/ ctx[12](null);
  			destroy_component(menu_1);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_21.name,
  		type: "slot",
  		source: "(38:4) <Section align=\\\"end\\\" toolbar>",
  		ctx
  	});

  	return block;
  }

  // (33:2) <Row>
  function create_default_slot_20(ctx) {
  	let t;
  	let current;

  	const section0 = new Section({
  			props: {
  				$$slots: { default: [create_default_slot_27] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const section1 = new Section({
  			props: {
  				align: "end",
  				toolbar: true,
  				$$slots: { default: [create_default_slot_21] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(section0.$$.fragment);
  			t = space();
  			create_component(section1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(section0, target, anchor);
  			insert_dev(target, t, anchor);
  			mount_component(section1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const section0_changes = {};

  			if (dirty & /*$$scope, name, myDrawerOpen*/ 4194313) {
  				section0_changes.$$scope = { dirty, ctx };
  			}

  			section0.$set(section0_changes);
  			const section1_changes = {};

  			if (dirty & /*$$scope, menu*/ 4194306) {
  				section1_changes.$$scope = { dirty, ctx };
  			}

  			section1.$set(section1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(section0.$$.fragment, local);
  			transition_in(section1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(section0.$$.fragment, local);
  			transition_out(section1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(section0, detaching);
  			if (detaching) detach_dev(t);
  			destroy_component(section1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_20.name,
  		type: "slot",
  		source: "(33:2) <Row>",
  		ctx
  	});

  	return block;
  }

  // (32:0) <TopAppBar variant="fixed">
  function create_default_slot_19(ctx) {
  	let current;

  	const row = new Row({
  			props: {
  				$$slots: { default: [create_default_slot_20] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(row.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(row, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const row_changes = {};

  			if (dirty & /*$$scope, menu, name, myDrawerOpen*/ 4194315) {
  				row_changes.$$scope = { dirty, ctx };
  			}

  			row.$set(row_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(row.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(row.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(row, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_19.name,
  		type: "slot",
  		source: "(32:0) <TopAppBar variant=\\\"fixed\\\">",
  		ctx
  	});

  	return block;
  }

  // (57:4) <Title>
  function create_default_slot_18(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Super Drawer");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_18.name,
  		type: "slot",
  		source: "(57:4) <Title>",
  		ctx
  	});

  	return block;
  }

  // (58:4) <Subtitle>
  function create_default_slot_17(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("It's the best drawer.");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_17.name,
  		type: "slot",
  		source: "(58:4) <Subtitle>",
  		ctx
  	});

  	return block;
  }

  // (56:2) <Header>
  function create_default_slot_16(ctx) {
  	let t;
  	let current;

  	const title = new Title({
  			props: {
  				$$slots: { default: [create_default_slot_18] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const subtitle = new Subtitle({
  			props: {
  				$$slots: { default: [create_default_slot_17] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(title.$$.fragment);
  			t = space();
  			create_component(subtitle.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(title, target, anchor);
  			insert_dev(target, t, anchor);
  			mount_component(subtitle, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const title_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				title_changes.$$scope = { dirty, ctx };
  			}

  			title.$set(title_changes);
  			const subtitle_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				subtitle_changes.$$scope = { dirty, ctx };
  			}

  			subtitle.$set(subtitle_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(title.$$.fragment, local);
  			transition_in(subtitle.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(title.$$.fragment, local);
  			transition_out(subtitle.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(title, detaching);
  			if (detaching) detach_dev(t);
  			destroy_component(subtitle, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_16.name,
  		type: "slot",
  		source: "(56:2) <Header>",
  		ctx
  	});

  	return block;
  }

  // (63:8) <Text>
  function create_default_slot_15(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Gray Kittens");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_15.name,
  		type: "slot",
  		source: "(63:8) <Text>",
  		ctx
  	});

  	return block;
  }

  // (62:6) <Item href="javascript:void(0)" on:click={() => setActive('Gray Kittens')} activated={active === 'Gray Kittens'}>
  function create_default_slot_14(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_15] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_14.name,
  		type: "slot",
  		source: "(62:6) <Item href=\\\"javascript:void(0)\\\" on:click={() => setActive('Gray Kittens')} activated={active === 'Gray Kittens'}>",
  		ctx
  	});

  	return block;
  }

  // (66:8) <Text>
  function create_default_slot_13(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("A Space Rocket");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_13.name,
  		type: "slot",
  		source: "(66:8) <Text>",
  		ctx
  	});

  	return block;
  }

  // (65:6) <Item href="javascript:void(0)" on:click={() => setActive('A Space Rocket')} activated={active === 'A Space Rocket'}>
  function create_default_slot_12(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_13] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_12.name,
  		type: "slot",
  		source: "(65:6) <Item href=\\\"javascript:void(0)\\\" on:click={() => setActive('A Space Rocket')} activated={active === 'A Space Rocket'}>",
  		ctx
  	});

  	return block;
  }

  // (69:8) <Text>
  function create_default_slot_11(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("100 Pounds of Gravel");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_11.name,
  		type: "slot",
  		source: "(69:8) <Text>",
  		ctx
  	});

  	return block;
  }

  // (68:6) <Item href="javascript:void(0)" on:click={() => setActive('100 Pounds of Gravel')} activated={active === '100 Pounds of Gravel'}>
  function create_default_slot_10(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_11] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_10.name,
  		type: "slot",
  		source: "(68:6) <Item href=\\\"javascript:void(0)\\\" on:click={() => setActive('100 Pounds of Gravel')} activated={active === '100 Pounds of Gravel'}>",
  		ctx
  	});

  	return block;
  }

  // (72:8) <Text>
  function create_default_slot_9(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("All of the Shrimp");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_9.name,
  		type: "slot",
  		source: "(72:8) <Text>",
  		ctx
  	});

  	return block;
  }

  // (71:6) <Item href="javascript:void(0)" on:click={() => setActive('All of the Shrimp')} activated={active === 'All of the Shrimp'}>
  function create_default_slot_8(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_9] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_8.name,
  		type: "slot",
  		source: "(71:6) <Item href=\\\"javascript:void(0)\\\" on:click={() => setActive('All of the Shrimp')} activated={active === 'All of the Shrimp'}>",
  		ctx
  	});

  	return block;
  }

  // (75:8) <Text>
  function create_default_slot_7(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("A Planet with a Mall");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_7.name,
  		type: "slot",
  		source: "(75:8) <Text>",
  		ctx
  	});

  	return block;
  }

  // (74:6) <Item href="javascript:void(0)" on:click={() => setActive('A Planet with a Mall')} activated={active === 'A Planet with a Mall'}>
  function create_default_slot_6(ctx) {
  	let current;

  	const text_1 = new Text({
  			props: {
  				$$slots: { default: [create_default_slot_7] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(text_1.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(text_1, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const text_1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				text_1_changes.$$scope = { dirty, ctx };
  			}

  			text_1.$set(text_1_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(text_1.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(text_1.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(text_1, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_6.name,
  		type: "slot",
  		source: "(74:6) <Item href=\\\"javascript:void(0)\\\" on:click={() => setActive('A Planet with a Mall')} activated={active === 'A Planet with a Mall'}>",
  		ctx
  	});

  	return block;
  }

  // (61:4) <List>
  function create_default_slot_5(ctx) {
  	let t0;
  	let t1;
  	let t2;
  	let t3;
  	let current;

  	const item0 = new Item({
  			props: {
  				href: "javascript:void(0)",
  				activated: /*active*/ ctx[8] === "Gray Kittens",
  				$$slots: { default: [create_default_slot_14] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item0.$on("click", /*click_handler_2*/ ctx[13]);

  	const item1 = new Item({
  			props: {
  				href: "javascript:void(0)",
  				activated: /*active*/ ctx[8] === "A Space Rocket",
  				$$slots: { default: [create_default_slot_12] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item1.$on("click", /*click_handler_3*/ ctx[14]);

  	const item2 = new Item({
  			props: {
  				href: "javascript:void(0)",
  				activated: /*active*/ ctx[8] === "100 Pounds of Gravel",
  				$$slots: { default: [create_default_slot_10] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item2.$on("click", /*click_handler_4*/ ctx[15]);

  	const item3 = new Item({
  			props: {
  				href: "javascript:void(0)",
  				activated: /*active*/ ctx[8] === "All of the Shrimp",
  				$$slots: { default: [create_default_slot_8] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item3.$on("click", /*click_handler_5*/ ctx[16]);

  	const item4 = new Item({
  			props: {
  				href: "javascript:void(0)",
  				activated: /*active*/ ctx[8] === "A Planet with a Mall",
  				$$slots: { default: [create_default_slot_6] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	item4.$on("click", /*click_handler_6*/ ctx[17]);

  	const block = {
  		c: function create() {
  			create_component(item0.$$.fragment);
  			t0 = space();
  			create_component(item1.$$.fragment);
  			t1 = space();
  			create_component(item2.$$.fragment);
  			t2 = space();
  			create_component(item3.$$.fragment);
  			t3 = space();
  			create_component(item4.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(item0, target, anchor);
  			insert_dev(target, t0, anchor);
  			mount_component(item1, target, anchor);
  			insert_dev(target, t1, anchor);
  			mount_component(item2, target, anchor);
  			insert_dev(target, t2, anchor);
  			mount_component(item3, target, anchor);
  			insert_dev(target, t3, anchor);
  			mount_component(item4, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const item0_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				item0_changes.$$scope = { dirty, ctx };
  			}

  			item0.$set(item0_changes);
  			const item1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				item1_changes.$$scope = { dirty, ctx };
  			}

  			item1.$set(item1_changes);
  			const item2_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				item2_changes.$$scope = { dirty, ctx };
  			}

  			item2.$set(item2_changes);
  			const item3_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				item3_changes.$$scope = { dirty, ctx };
  			}

  			item3.$set(item3_changes);
  			const item4_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				item4_changes.$$scope = { dirty, ctx };
  			}

  			item4.$set(item4_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(item0.$$.fragment, local);
  			transition_in(item1.$$.fragment, local);
  			transition_in(item2.$$.fragment, local);
  			transition_in(item3.$$.fragment, local);
  			transition_in(item4.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(item0.$$.fragment, local);
  			transition_out(item1.$$.fragment, local);
  			transition_out(item2.$$.fragment, local);
  			transition_out(item3.$$.fragment, local);
  			transition_out(item4.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(item0, detaching);
  			if (detaching) detach_dev(t0);
  			destroy_component(item1, detaching);
  			if (detaching) detach_dev(t1);
  			destroy_component(item2, detaching);
  			if (detaching) detach_dev(t2);
  			destroy_component(item3, detaching);
  			if (detaching) detach_dev(t3);
  			destroy_component(item4, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_5.name,
  		type: "slot",
  		source: "(61:4) <List>",
  		ctx
  	});

  	return block;
  }

  // (60:2) <Content>
  function create_default_slot_4(ctx) {
  	let current;

  	const list = new List({
  			props: {
  				$$slots: { default: [create_default_slot_5] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(list.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(list, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const list_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				list_changes.$$scope = { dirty, ctx };
  			}

  			list.$set(list_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(list.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(list.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(list, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_4.name,
  		type: "slot",
  		source: "(60:2) <Content>",
  		ctx
  	});

  	return block;
  }

  // (55:0) <Drawer class="app-drawer-layout" variant="dismissible" bind:this={myDrawer} bind:open={myDrawerOpen}>
  function create_default_slot_3$1(ctx) {
  	let t;
  	let current;

  	const header = new Header({
  			props: {
  				$$slots: { default: [create_default_slot_16] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const content = new Content({
  			props: {
  				$$slots: { default: [create_default_slot_4] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	const block = {
  		c: function create() {
  			create_component(header.$$.fragment);
  			t = space();
  			create_component(content.$$.fragment);
  		},
  		m: function mount(target, anchor) {
  			mount_component(header, target, anchor);
  			insert_dev(target, t, anchor);
  			mount_component(content, target, anchor);
  			current = true;
  		},
  		p: function update(ctx, dirty) {
  			const header_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				header_changes.$$scope = { dirty, ctx };
  			}

  			header.$set(header_changes);
  			const content_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				content_changes.$$scope = { dirty, ctx };
  			}

  			content.$set(content_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(header.$$.fragment, local);
  			transition_in(content.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(header.$$.fragment, local);
  			transition_out(content.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			destroy_component(header, detaching);
  			if (detaching) detach_dev(t);
  			destroy_component(content, detaching);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_3$1.name,
  		type: "slot",
  		source: "(55:0) <Drawer class=\\\"app-drawer-layout\\\" variant=\\\"dismissible\\\" bind:this={myDrawer} bind:open={myDrawerOpen}>",
  		ctx
  	});

  	return block;
  }

  // (86:2) <Counter value={1}>
  function create_default_slot_2$2(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Counter 1ab");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_2$2.name,
  		type: "slot",
  		source: "(86:2) <Counter value={1}>",
  		ctx
  	});

  	return block;
  }

  // (87:2) <Counter bind:value={$count} step={3}>
  function create_default_slot_1$2(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Counter 2");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot_1$2.name,
  		type: "slot",
  		source: "(87:2) <Counter bind:value={$count} step={3}>",
  		ctx
  	});

  	return block;
  }

  // (88:2) <Counter bind:value={$myStore} step={5}>
  function create_default_slot$4(ctx) {
  	let t;

  	const block = {
  		c: function create() {
  			t = text("Counter 3");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, t, anchor);
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(t);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_default_slot$4.name,
  		type: "slot",
  		source: "(88:2) <Counter bind:value={$myStore} step={5}>",
  		ctx
  	});

  	return block;
  }

  function create_fragment$j(ctx) {
  	let div0;
  	let t0;
  	let updating_open;
  	let t1;
  	let main;
  	let div1;
  	let p0;
  	let t2;
  	let t3;
  	let t4;
  	let updating_value;
  	let t5;
  	let updating_value_1;
  	let t6;
  	let p1;
  	let t8;
  	let p2;
  	let t10;
  	let p3;
  	let t12;
  	let p4;
  	let t14;
  	let p5;
  	let t16;
  	let p6;
  	let t18;
  	let p7;
  	let t20;
  	let p8;
  	let t22;
  	let p9;
  	let t24;
  	let p10;
  	let t26;
  	let p11;
  	let t28;
  	let p12;
  	let t30;
  	let p13;
  	let t32;
  	let p14;
  	let t34;
  	let p15;
  	let t36;
  	let p16;
  	let t38;
  	let p17;
  	let t40;
  	let p18;
  	let t42;
  	let p19;
  	let t44;
  	let p20;
  	let t46;
  	let p21;
  	let t48;
  	let p22;
  	let t50;
  	let p23;
  	let t52;
  	let p24;
  	let current;

  	const topappbar = new TopAppBar({
  			props: {
  				variant: "fixed",
  				$$slots: { default: [create_default_slot_19] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	function drawer_open_binding(value) {
  		/*drawer_open_binding*/ ctx[19].call(null, value);
  	}

  	let drawer_props = {
  		class: "app-drawer-layout",
  		variant: "dismissible",
  		$$slots: { default: [create_default_slot_3$1] },
  		$$scope: { ctx }
  	};

  	if (/*myDrawerOpen*/ ctx[3] !== void 0) {
  		drawer_props.open = /*myDrawerOpen*/ ctx[3];
  	}

  	const drawer = new Drawer({ props: drawer_props, $$inline: true });
  	/*drawer_binding*/ ctx[18](drawer);
  	binding_callbacks.push(() => bind(drawer, "open", drawer_open_binding));
  	const profile_spread_levels = [/*$user*/ ctx[4]];
  	let profile_props = {};

  	for (let i = 0; i < profile_spread_levels.length; i += 1) {
  		profile_props = assign(profile_props, profile_spread_levels[i]);
  	}

  	const profile = new Profile({ props: profile_props, $$inline: true });
  	const counter0 = new Counter({ $$inline: true });

  	const counter1 = new Counter({
  			props: {
  				value: 1,
  				$$slots: { default: [create_default_slot_2$2] },
  				$$scope: { ctx }
  			},
  			$$inline: true
  		});

  	function counter2_value_binding(value_1) {
  		/*counter2_value_binding*/ ctx[20].call(null, value_1);
  	}

  	let counter2_props = {
  		step: 3,
  		$$slots: { default: [create_default_slot_1$2] },
  		$$scope: { ctx }
  	};

  	if (/*$count*/ ctx[5] !== void 0) {
  		counter2_props.value = /*$count*/ ctx[5];
  	}

  	const counter2 = new Counter({ props: counter2_props, $$inline: true });
  	binding_callbacks.push(() => bind(counter2, "value", counter2_value_binding));

  	function counter3_value_binding(value_2) {
  		/*counter3_value_binding*/ ctx[21].call(null, value_2);
  	}

  	let counter3_props = {
  		step: 5,
  		$$slots: { default: [create_default_slot$4] },
  		$$scope: { ctx }
  	};

  	if (/*$myStore*/ ctx[6] !== void 0) {
  		counter3_props.value = /*$myStore*/ ctx[6];
  	}

  	const counter3 = new Counter({ props: counter3_props, $$inline: true });
  	binding_callbacks.push(() => bind(counter3, "value", counter3_value_binding));

  	const block = {
  		c: function create() {
  			div0 = element("div");
  			create_component(topappbar.$$.fragment);
  			t0 = space();
  			create_component(drawer.$$.fragment);
  			t1 = space();
  			main = element("main");
  			div1 = element("div");
  			p0 = element("p");
  			create_component(profile.$$.fragment);
  			t2 = space();
  			create_component(counter0.$$.fragment);
  			t3 = space();
  			create_component(counter1.$$.fragment);
  			t4 = space();
  			create_component(counter2.$$.fragment);
  			t5 = space();
  			create_component(counter3.$$.fragment);
  			t6 = space();
  			p1 = element("p");
  			p1.textContent = "blah";
  			t8 = space();
  			p2 = element("p");
  			p2.textContent = "blah";
  			t10 = space();
  			p3 = element("p");
  			p3.textContent = "blah";
  			t12 = space();
  			p4 = element("p");
  			p4.textContent = "blah";
  			t14 = space();
  			p5 = element("p");
  			p5.textContent = "blah";
  			t16 = space();
  			p6 = element("p");
  			p6.textContent = "blah";
  			t18 = space();
  			p7 = element("p");
  			p7.textContent = "blah";
  			t20 = space();
  			p8 = element("p");
  			p8.textContent = "blah";
  			t22 = space();
  			p9 = element("p");
  			p9.textContent = "blah";
  			t24 = space();
  			p10 = element("p");
  			p10.textContent = "blah";
  			t26 = space();
  			p11 = element("p");
  			p11.textContent = "blah";
  			t28 = space();
  			p12 = element("p");
  			p12.textContent = "blah";
  			t30 = space();
  			p13 = element("p");
  			p13.textContent = "blah";
  			t32 = space();
  			p14 = element("p");
  			p14.textContent = "blah";
  			t34 = space();
  			p15 = element("p");
  			p15.textContent = "blah";
  			t36 = space();
  			p16 = element("p");
  			p16.textContent = "blah";
  			t38 = space();
  			p17 = element("p");
  			p17.textContent = "blah";
  			t40 = space();
  			p18 = element("p");
  			p18.textContent = "blah";
  			t42 = space();
  			p19 = element("p");
  			p19.textContent = "blah";
  			t44 = space();
  			p20 = element("p");
  			p20.textContent = "blah";
  			t46 = space();
  			p21 = element("p");
  			p21.textContent = "blah";
  			t48 = space();
  			p22 = element("p");
  			p22.textContent = "blah";
  			t50 = space();
  			p23 = element("p");
  			p23.textContent = "blah";
  			t52 = space();
  			p24 = element("p");
  			p24.textContent = "blah";
  			attr_dev(div0, "class", "");
  			add_location(div0, file$g, 30, 0, 961);
  			add_location(p0, file$g, 82, 0, 3050);
  			add_location(p1, file$g, 89, 0, 3263);
  			add_location(p2, file$g, 90, 0, 3275);
  			add_location(p3, file$g, 91, 0, 3287);
  			add_location(p4, file$g, 92, 0, 3299);
  			add_location(p5, file$g, 93, 0, 3311);
  			add_location(p6, file$g, 94, 0, 3323);
  			add_location(p7, file$g, 95, 0, 3335);
  			add_location(p8, file$g, 96, 0, 3347);
  			add_location(p9, file$g, 97, 0, 3359);
  			add_location(p10, file$g, 98, 0, 3371);
  			add_location(p11, file$g, 99, 0, 3383);
  			add_location(p12, file$g, 100, 0, 3395);
  			add_location(p13, file$g, 101, 0, 3407);
  			add_location(p14, file$g, 102, 0, 3419);
  			add_location(p15, file$g, 103, 0, 3431);
  			add_location(p16, file$g, 104, 0, 3443);
  			add_location(p17, file$g, 105, 0, 3455);
  			add_location(p18, file$g, 106, 0, 3467);
  			add_location(p19, file$g, 107, 0, 3479);
  			add_location(p20, file$g, 108, 0, 3491);
  			add_location(p21, file$g, 109, 0, 3503);
  			add_location(p22, file$g, 110, 0, 3515);
  			add_location(p23, file$g, 111, 0, 3527);
  			add_location(p24, file$g, 112, 0, 3539);
  			attr_dev(div1, "class", "mdc-top-app-bar--fixed-adjust ");
  			add_location(div1, file$g, 81, 0, 3005);
  			attr_dev(main, "class", "main-content mdc-drawer-app-content");
  			add_location(main, file$g, 79, 0, 2953);
  		},
  		l: function claim(nodes) {
  			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
  		},
  		m: function mount(target, anchor) {
  			insert_dev(target, div0, anchor);
  			mount_component(topappbar, div0, null);
  			insert_dev(target, t0, anchor);
  			mount_component(drawer, target, anchor);
  			insert_dev(target, t1, anchor);
  			insert_dev(target, main, anchor);
  			append_dev(main, div1);
  			append_dev(div1, p0);
  			mount_component(profile, p0, null);
  			append_dev(p0, t2);
  			mount_component(counter0, p0, null);
  			append_dev(p0, t3);
  			mount_component(counter1, p0, null);
  			append_dev(p0, t4);
  			mount_component(counter2, p0, null);
  			append_dev(p0, t5);
  			mount_component(counter3, p0, null);
  			append_dev(div1, t6);
  			append_dev(div1, p1);
  			append_dev(div1, t8);
  			append_dev(div1, p2);
  			append_dev(div1, t10);
  			append_dev(div1, p3);
  			append_dev(div1, t12);
  			append_dev(div1, p4);
  			append_dev(div1, t14);
  			append_dev(div1, p5);
  			append_dev(div1, t16);
  			append_dev(div1, p6);
  			append_dev(div1, t18);
  			append_dev(div1, p7);
  			append_dev(div1, t20);
  			append_dev(div1, p8);
  			append_dev(div1, t22);
  			append_dev(div1, p9);
  			append_dev(div1, t24);
  			append_dev(div1, p10);
  			append_dev(div1, t26);
  			append_dev(div1, p11);
  			append_dev(div1, t28);
  			append_dev(div1, p12);
  			append_dev(div1, t30);
  			append_dev(div1, p13);
  			append_dev(div1, t32);
  			append_dev(div1, p14);
  			append_dev(div1, t34);
  			append_dev(div1, p15);
  			append_dev(div1, t36);
  			append_dev(div1, p16);
  			append_dev(div1, t38);
  			append_dev(div1, p17);
  			append_dev(div1, t40);
  			append_dev(div1, p18);
  			append_dev(div1, t42);
  			append_dev(div1, p19);
  			append_dev(div1, t44);
  			append_dev(div1, p20);
  			append_dev(div1, t46);
  			append_dev(div1, p21);
  			append_dev(div1, t48);
  			append_dev(div1, p22);
  			append_dev(div1, t50);
  			append_dev(div1, p23);
  			append_dev(div1, t52);
  			append_dev(div1, p24);
  			current = true;
  		},
  		p: function update(ctx, [dirty]) {
  			const topappbar_changes = {};

  			if (dirty & /*$$scope, menu, name, myDrawerOpen*/ 4194315) {
  				topappbar_changes.$$scope = { dirty, ctx };
  			}

  			topappbar.$set(topappbar_changes);
  			const drawer_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				drawer_changes.$$scope = { dirty, ctx };
  			}

  			if (!updating_open && dirty & /*myDrawerOpen*/ 8) {
  				updating_open = true;
  				drawer_changes.open = /*myDrawerOpen*/ ctx[3];
  				add_flush_callback(() => updating_open = false);
  			}

  			drawer.$set(drawer_changes);

  			const profile_changes = (dirty & /*$user*/ 16)
  			? get_spread_update(profile_spread_levels, [get_spread_object(/*$user*/ ctx[4])])
  			: {};

  			profile.$set(profile_changes);
  			const counter1_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				counter1_changes.$$scope = { dirty, ctx };
  			}

  			counter1.$set(counter1_changes);
  			const counter2_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				counter2_changes.$$scope = { dirty, ctx };
  			}

  			if (!updating_value && dirty & /*$count*/ 32) {
  				updating_value = true;
  				counter2_changes.value = /*$count*/ ctx[5];
  				add_flush_callback(() => updating_value = false);
  			}

  			counter2.$set(counter2_changes);
  			const counter3_changes = {};

  			if (dirty & /*$$scope*/ 4194304) {
  				counter3_changes.$$scope = { dirty, ctx };
  			}

  			if (!updating_value_1 && dirty & /*$myStore*/ 64) {
  				updating_value_1 = true;
  				counter3_changes.value = /*$myStore*/ ctx[6];
  				add_flush_callback(() => updating_value_1 = false);
  			}

  			counter3.$set(counter3_changes);
  		},
  		i: function intro(local) {
  			if (current) return;
  			transition_in(topappbar.$$.fragment, local);
  			transition_in(drawer.$$.fragment, local);
  			transition_in(profile.$$.fragment, local);
  			transition_in(counter0.$$.fragment, local);
  			transition_in(counter1.$$.fragment, local);
  			transition_in(counter2.$$.fragment, local);
  			transition_in(counter3.$$.fragment, local);
  			current = true;
  		},
  		o: function outro(local) {
  			transition_out(topappbar.$$.fragment, local);
  			transition_out(drawer.$$.fragment, local);
  			transition_out(profile.$$.fragment, local);
  			transition_out(counter0.$$.fragment, local);
  			transition_out(counter1.$$.fragment, local);
  			transition_out(counter2.$$.fragment, local);
  			transition_out(counter3.$$.fragment, local);
  			current = false;
  		},
  		d: function destroy(detaching) {
  			if (detaching) detach_dev(div0);
  			destroy_component(topappbar);
  			if (detaching) detach_dev(t0);
  			/*drawer_binding*/ ctx[18](null);
  			destroy_component(drawer, detaching);
  			if (detaching) detach_dev(t1);
  			if (detaching) detach_dev(main);
  			destroy_component(profile);
  			destroy_component(counter0);
  			destroy_component(counter1);
  			destroy_component(counter2);
  			destroy_component(counter3);
  		}
  	};

  	dispatch_dev("SvelteRegisterBlock", {
  		block,
  		id: create_fragment$j.name,
  		type: "component",
  		source: "",
  		ctx
  	});

  	return block;
  }

  function instance$j($$self, $$props, $$invalidate) {
  	let $user;
  	let $count;
  	let $myStore;
  	validate_store(user, "user");
  	component_subscribe($$self, user, $$value => $$invalidate(4, $user = $$value));
  	validate_store(myStore, "myStore");
  	component_subscribe($$self, myStore, $$value => $$invalidate(6, $myStore = $$value));
  	const count = writable(100);
  	validate_store(count, "count");
  	component_subscribe($$self, count, value => $$invalidate(5, $count = value));
  	const unsubscribe = count.subscribe(value => console.log("count", value));
  	let { name } = $$props;
  	let menu;
  	let myDrawer;
  	let myDrawerOpen = false;
  	let active = "Gray Kittens";

  	onMount(() => {
  		console.log("App mounted");
  	});

  	onDestroy(() => {
  		unsubscribe();
  	});

  	const writable_props = ["name"];

  	Object.keys($$props).forEach(key => {
  		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
  	});

  	const click_handler = () => $$invalidate(3, myDrawerOpen = !myDrawerOpen);
  	const click_handler_1 = () => menu.setOpen(true);

  	function menu_1_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(1, menu = $$value);
  		});
  	}

  	const click_handler_2 = () => setActive("Gray Kittens");
  	const click_handler_3 = () => setActive("A Space Rocket");
  	const click_handler_4 = () => setActive("100 Pounds of Gravel");
  	const click_handler_5 = () => setActive("All of the Shrimp");
  	const click_handler_6 = () => setActive("A Planet with a Mall");

  	function drawer_binding($$value) {
  		binding_callbacks[$$value ? "unshift" : "push"](() => {
  			$$invalidate(2, myDrawer = $$value);
  		});
  	}

  	function drawer_open_binding(value) {
  		myDrawerOpen = value;
  		$$invalidate(3, myDrawerOpen);
  	}

  	function counter2_value_binding(value_1) {
  		$count = value_1;
  		count.set($count);
  	}

  	function counter3_value_binding(value_2) {
  		$myStore = value_2;
  		myStore.set($myStore);
  	}

  	$$self.$set = $$props => {
  		if ("name" in $$props) $$invalidate(0, name = $$props.name);
  	};

  	$$self.$capture_state = () => {
  		return {
  			name,
  			menu,
  			myDrawer,
  			myDrawerOpen,
  			active,
  			$user,
  			$count,
  			$myStore
  		};
  	};

  	$$self.$inject_state = $$props => {
  		if ("name" in $$props) $$invalidate(0, name = $$props.name);
  		if ("menu" in $$props) $$invalidate(1, menu = $$props.menu);
  		if ("myDrawer" in $$props) $$invalidate(2, myDrawer = $$props.myDrawer);
  		if ("myDrawerOpen" in $$props) $$invalidate(3, myDrawerOpen = $$props.myDrawerOpen);
  		if ("active" in $$props) $$invalidate(8, active = $$props.active);
  		if ("$user" in $$props) user.set($user = $$props.$user);
  		if ("$count" in $$props) count.set($count = $$props.$count);
  		if ("$myStore" in $$props) myStore.set($myStore = $$props.$myStore);
  	};

  	return [
  		name,
  		menu,
  		myDrawer,
  		myDrawerOpen,
  		$user,
  		$count,
  		$myStore,
  		count,
  		active,
  		unsubscribe,
  		click_handler,
  		click_handler_1,
  		menu_1_binding,
  		click_handler_2,
  		click_handler_3,
  		click_handler_4,
  		click_handler_5,
  		click_handler_6,
  		drawer_binding,
  		drawer_open_binding,
  		counter2_value_binding,
  		counter3_value_binding
  	];
  }

  class App extends SvelteComponentDev {
  	constructor(options) {
  		super(options);
  		init(this, options, instance$j, create_fragment$j, safe_not_equal, { name: 0 });

  		dispatch_dev("SvelteRegisterComponent", {
  			component: this,
  			tagName: "App",
  			options,
  			id: create_fragment$j.name
  		});

  		const { ctx } = this.$$;
  		const props = options.props || ({});

  		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
  			console_1.warn("<App> was created without expected prop 'name'");
  		}
  	}

  	get name() {
  		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}

  	set name(value) {
  		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
  	}
  }

  const app = new App({
      target: document.body,
      props: {
          name: "world"
      }
  });

  return app;

}());
//# sourceMappingURL=bundle.js.map

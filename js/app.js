/*
 * Application bootstrap: URL parameters, keyboard control, the tick loop, and
 * sizing the character grid to fill the viewport.
 *
 * No flight information and no presentation decisions live here. This file
 * decides *when* things happen; data/ decides *what* is shown.
 */
(function (global) {
  "use strict";

  var THEMES = ["green", "amber", "white"];
  var MIN_FONT_PX = 8;
  var MAX_FONT_PX = 220;

  function params() {
    return new URLSearchParams(global.location.search);
  }

  function flag(value, fallback) {
    if (value == null) return fallback;
    return !(
      value === "0" ||
      value.toLowerCase() === "false" ||
      value === "off"
    );
  }

  function boot() {
    var body = document.body;
    var screen = document.getElementById("screen");
    var boardEl = document.getElementById("board");
    var devbar = document.getElementById("devbar");

    var states = FIDS.States.load();
    var flights = (global.FIDS_DATA && global.FIDS_DATA.flights) || [];
    if (!flights.length)
      throw new Error("No flights: data/flights.js did not load");

    var query = params();
    var stateName = query.get("state");
    if (!stateName || !states.has(stateName)) stateName = states.defaultState;

    var presentation = flag(query.get("presentation"), false);
    var theme = query.get("theme");
    if (THEMES.indexOf(theme) === -1) theme = THEMES[0];
    var crt = flag(query.get("crt"), true);
    var pageLocked = flag(query.get("pagelock"), false);

    var overrides = {
      rowsPerPage: parseInt(query.get("rows"), 10),
      rotateSeconds:
        query.get("rotate") == null ? NaN : Number(query.get("rotate")),
      tickMs: parseInt(query.get("tick"), 10),
      seed: query.get("seed"),
    };

    var board = null;
    var state = null;
    var tick = 0;
    var ticksOnPage = 0;
    var paused = false;
    var timer = null;

    body.dataset.theme = theme;
    body.dataset.crt = crt ? "on" : "off";
    body.dataset.presentation = presentation ? "true" : "false";

    function resolveState(name) {
      var resolved = states.get(name);
      // Clone the bits the URL may override so the loaded config stays pristine.
      var patch = { pagination: {}, staging: {} };
      if (overrides.rowsPerPage > 0)
        patch.pagination.rowsPerPage = overrides.rowsPerPage;
      if (!isNaN(overrides.rotateSeconds))
        patch.pagination.rotateSeconds = overrides.rotateSeconds;
      if (overrides.tickMs > 0) patch.tickMs = overrides.tickMs;
      if (overrides.seed) patch.staging.seed = overrides.seed;
      return FIDS.States.deepMerge(resolved, patch);
    }

    function rotateTicks() {
      var seconds = (state.pagination && state.pagination.rotateSeconds) || 0;
      if (!seconds) return 0;
      return Math.max(1, Math.round((seconds * 1000) / (state.tickMs || 250)));
    }

    var charRatio = null;

    function measureCharRatio() {
      var probe = document.createElement("span");
      probe.style.cssText =
        "position:absolute;visibility:hidden;white-space:pre;font-size:100px;left:-9999px;top:0;";
      probe.textContent = new Array(101).join("M");
      boardEl.appendChild(probe);
      var ratio = probe.getBoundingClientRect().width / 100 / 100;
      boardEl.removeChild(probe);
      return ratio || 0.6;
    }

    function fit() {
      if (!board) return;
      if (!charRatio) charRatio = measureCharRatio();
      var lineHeight =
        parseFloat(getComputedStyle(body).getPropertyValue("--line-height")) ||
        1.35;
      var lines = boardEl.childElementCount || 1;
      var byWidth = screen.clientWidth / (board.width * charRatio);
      var byHeight = screen.clientHeight / (lines * lineHeight);
      var size = Math.max(
        MIN_FONT_PX,
        Math.min(MAX_FONT_PX, Math.min(byWidth, byHeight)),
      );
      boardEl.style.fontSize = size.toFixed(2) + "px";
    }

    function syncUrl() {
      var next = params();
      next.set("state", stateName);
      next.set("page", String(board.pageIndex + 1));
      if (presentation) next.set("presentation", "true");
      else next.delete("presentation");
      if (pageLocked) next.set("pagelock", "true");
      else next.delete("pagelock");
      try {
        history.replaceState(
          null,
          "",
          location.pathname + "?" + next.toString(),
        );
      } catch (error) {
        // Opaque origins (opening index.html straight off disk) refuse this.
        // The board does not depend on the URL once it is running.
      }
    }

    function renderDevbar() {
      if (presentation) {
        devbar.innerHTML = "";
        return;
      }
      var parts = states.names.map(function (name, index) {
        return (
          '<button type="button" data-state="' +
          name +
          '"' +
          (name === stateName ? ' class="active"' : "") +
          ">[" +
          (index + 1) +
          "] " +
          states.label(name).toUpperCase() +
          "</button>"
        );
      });
      parts.push(
        "<span>PAGE " +
          (board.pageIndex + 1) +
          "/" +
          board.pageCount +
          (pageLocked ? " LOCKED" : "") +
          " &middot; " +
          board.flightCount +
          " AIRCRAFT</span>",
      );
      parts.push("<span>" + (paused ? "PAUSED" : "RUNNING") + "</span>");
      parts.push(
        "<span class='hint'>SPACE PAUSE &middot; &larr;/&rarr; PAGE &middot; L LOCK PAGE &middot; P PRESENT &middot; T THEME &middot; C CRT &middot; F FULLSCREEN</span>",
      );
      devbar.innerHTML = parts.join("");
    }

    function build(initialPage) {
      state = resolveState(stateName);
      board = FIDS.Board.create(boardEl, state, flights);
      tick = 0;
      ticksOnPage = 0;
      if (initialPage) board.setPage(initialPage - 1, 0);
      fit();
      renderDevbar();
      syncUrl();
      restartLoop();
    }

    function step() {
      if (paused) return;
      tick += 1;
      ticksOnPage += 1;
      board.update(tick);
      if (pageLocked) return;
      var limit = rotateTicks();
      if (limit && board.pageCount > 1 && ticksOnPage >= limit) {
        ticksOnPage = 0;
        board.setPage(board.pageIndex + 1, tick);
        renderDevbar();
        syncUrl();
      }
    }

    function restartLoop() {
      if (timer) clearInterval(timer);
      timer = setInterval(step, state.tickMs || 250);
    }

    function setState(name) {
      if (!states.has(name) || name === stateName) return;
      stateName = name;
      build();
    }

    function setPage(index) {
      board.setPage(index, tick);
      ticksOnPage = 0;
      renderDevbar();
      syncUrl();
    }

    function setPresentation(value) {
      presentation = value;
      body.dataset.presentation = presentation ? "true" : "false";
      renderDevbar();
      syncUrl();
      requestAnimationFrame(fit);
    }

    document.addEventListener("keydown", function (event) {
      var index = parseInt(event.key, 10);
      if (!isNaN(index) && index >= 1 && index <= states.names.length) {
        setState(states.names[index - 1]);
        return;
      }
      switch (event.key) {
        case " ":
          event.preventDefault();
          paused = !paused;
          renderDevbar();
          break;
        case "ArrowRight":
          setPage(board.pageIndex + 1);
          break;
        case "ArrowLeft":
          setPage(board.pageIndex - 1);
          break;
        case "l":
        case "L":
          pageLocked = !pageLocked;
          ticksOnPage = 0;
          renderDevbar();
          syncUrl();
          break;
        case "p":
        case "P":
          setPresentation(!presentation);
          break;
        case "c":
        case "C":
          crt = !crt;
          body.dataset.crt = crt ? "on" : "off";
          break;
        case "t":
        case "T":
          theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
          body.dataset.theme = theme;
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        default:
          break;
      }
    });

    devbar.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-state]");
      if (button) setState(button.dataset.state);
    });

    var resizeFrame = null;
    global.addEventListener("resize", function () {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(function () {
        charRatio = null;
        fit();
      });
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        charRatio = null;
        fit();
      });
    }

    var startPage = parseInt(query.get("page"), 10);
    build(startPage > 0 ? startPage : 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);

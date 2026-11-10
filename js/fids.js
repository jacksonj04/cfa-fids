/*
 * The display engine.
 *
 * Turns flights + a display state into a fixed-width character grid, then
 * repaints cells as the tick advances. It knows nothing about which flights
 * exist or what the board is meant to say: every column, width, placeholder
 * and staging rule arrives from the display state.
 *
 * The board is laid out as real characters padded to real column widths, so
 * alignment is done the way a 2001 board would have done it rather than with
 * CSS table layout.
 */
(function (global) {
  "use strict";

  var Animations = global.FIDS.Animations;
  var Staging = global.FIDS.Staging;

  function repeat(char, count) {
    return count > 0 ? new Array(count + 1).join(char) : "";
  }

  function pad(text, width, align) {
    var value = text == null ? "" : String(text);
    if (value.length > width) value = value.slice(0, width);
    var space = width - value.length;
    return align === "right"
      ? repeat(" ", space) + value
      : value + repeat(" ", space);
  }

  function centre(text, width) {
    var value = text == null ? "" : String(text);
    if (value.length >= width) return value.slice(0, width);
    return repeat(" ", Math.floor((width - value.length) / 2)) + value;
  }

  function transform(text, transforms) {
    var value = String(text);
    (transforms || []).forEach(function (name) {
      if (name === "uppercase") {
        value = value.toUpperCase();
      } else if (name === "ascii") {
        value = value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\x20-\x7E]/g, "?");
      }
    });
    return value;
  }

  function boardWidth(columns) {
    return columns.reduce(function (total, column) {
      return total + column.width;
    }, 0);
  }

  // Stable shuffle: the same seed and flight IDs always produce the same
  // pagination, regardless of the input dataset's original grouping.
  function shuffleFlights(flights, seed) {
    var result = flights.slice().sort(function (a, b) {
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    for (var i = result.length - 1; i > 0; i--) {
      var j = Animations.hash(String(seed) + ":row:" + i) % (i + 1);
      var item = result[i];
      result[i] = result[j];
      result[j] = item;
    }
    return result;
  }

  function orderFlights(flights, order, simulation) {
    if (order && order.mode === "shuffle") {
      return shuffleFlights(flights, order.seed || "gander-rows");
    }
    if (order && order.mode === "simulation") {
      var schedule = simulation || {};
      return flights.slice().sort(function (a, b) {
        var left = schedule[a.id] && schedule[a.id].order;
        var right = schedule[b.id] && schedule[b.id].order;
        if (left == null) return right == null ? 0 : 1;
        if (right == null) return -1;
        return left - right;
      });
    }
    if (!order || order.mode === "dataset" || !order.by) return flights.slice();
    var keys = Array.isArray(order.by) ? order.by : [order.by];
    var direction = order.direction === "desc" ? -1 : 1;
    return flights.slice().sort(function (a, b) {
      for (var i = 0; i < keys.length; i++) {
        var left = a[keys[i]];
        var right = b[keys[i]];
        if (left == null && right == null) continue;
        if (left == null) return 1; // unknowns sort last regardless of direction
        if (right == null) return -1;
        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
      }
      return 0;
    });
  }

  function placeholderFor(column, state) {
    if (column.placeholder != null) return column.placeholder;
    var placeholders = state.placeholders || {};
    return placeholders.text || "";
  }

  function resolveCell(flight, column, state) {
    var raw = null;

    if (column.value != null) {
      raw = column.value;
    } else if (column.field) {
      raw = flight[column.field];
    }

    var text =
      raw == null || raw === ""
        ? placeholderFor(column, state)
        : transform(String(raw), state.transform);

    return { text: text };
  }

  /** Data -> display rows. Pure; useful on its own for checking a dataset. */
  function buildRows(flights, state) {
    return orderFlights(flights, state.order, global.FIDS_DATA && global.FIDS_DATA.arrivalSimulation).map(function (flight) {
      return {
        id: flight.id,
        flight: flight,
        cells: state.columns.map(function (column) {
          var resolved = resolveCell(flight, column, state);
          return {
            key: column.key,
            width: column.width,
            align: column.align,
            text: resolved.text,
            seed: flight.id + ":" + column.key,
          };
        }),
      };
    });
  }

  function paginate(rows, rowsPerPage) {
    var size = Math.max(1, rowsPerPage | 0);
    var pages = [];
    for (var i = 0; i < rows.length; i += size)
      pages.push(rows.slice(i, i + size));
    return pages.length ? pages : [[]];
  }

  function line(className) {
    var el = document.createElement("div");
    el.className = "line" + (className ? " " + className : "");
    return el;
  }

  function shiftEta(eta, minutes) {
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(eta || "")) return null;
    var parts = eta.split(":");
    var total = Number(parts[0]) * 60 + Number(parts[1]) + minutes;
    total = ((total % 1440) + 1440) % 1440;
    return ("0" + Math.floor(total / 60)).slice(-2) + ":" +
      ("0" + total % 60).slice(-2);
  }

  function cellTextForTick(row, cell, cellIndex, state, tick, generative) {
    if (!generative) return cell.text;

    var staging = state.staging;
    var tickMs = state.tickMs || 250;
    var segment = Staging.segmentAt(row.id, tick, tickMs, staging);
    var timing = Staging.refreshTiming(staging, tickMs, state.columns.length);

    if (!Staging.columnVisible(segment.age, cellIndex, timing)) return "";

    var column = state.columns[cellIndex];
    var text = cell.text;
    var shouldBlink = false;

    if (column.key === "time") {
      var landing =
        row.flight && row.flight.landingTime != null && row.flight.landingTime !== ""
          ? transform(String(row.flight.landingTime), state.transform)
          : null;
      if (landing != null) {
        text = landing;
      } else if (segment.useEta) {
        var schedule = global.FIDS_DATA && global.FIDS_DATA.arrivalSimulation;
        var simulated = schedule && schedule[row.id];
        text = simulated
          ? (shiftEta(simulated.eta, segment.etaOffsetMinutes) ||
            placeholderFor(column, state))
          : placeholderFor(column, state);
      } else if (segment.statusValue != null) {
        text = transform(String(segment.statusValue), state.transform);
      } else {
        text = placeholderFor(column, state);
      }
      shouldBlink = segment.timeBlink && landing == null;
    }

    if (shouldBlink) {
      text = Animations.blink(
        text,
        tick,
        (staging.seed || "") + ":" + cell.seed,
        staging.blink,
      );
    }

    return text;
  }

  /**
   * Builds the DOM for a state and returns a controller.
   * The DOM shape is stable for the life of the board: paging and staging
   * only ever rewrite text, never structure.
   */
  function createBoard(container, state, flights) {
    var columns = state.columns;
    var width = boardWidth(columns);
    var pagination = state.pagination || {};
    var rowsPerPage = Math.max(1, pagination.rowsPerPage | 0 || 16);
    var rows = buildRows(flights, state);
    var pages = paginate(rows, rowsPerPage);
    var pageIndex = 0;
    var slots = [];
    var messageState = { index: 0, lastAdvanceTick: 0 };
    var generative = Staging.isGenerative(state.staging);

    container.innerHTML = "";
    container.appendChild(line("title")).textContent = centre(
      transform(state.airportName || "", state.transform),
      width,
    );
    container.appendChild(line("spacer")).textContent = "";

    var header = state.header || {};
    var headerLeft = transform(header.left || "", state.transform);
    var headerRight = transform(header.right || "", state.transform);
    container.appendChild(line("header")).textContent =
      pad(headerLeft, width - headerRight.length) + headerRight;

    container.appendChild(line("rule")).textContent = repeat("-", width);

    var labels = line("labels");
    labels.textContent = columns
      .map(function (column) {
        return pad(
          transform(column.label || "", state.transform),
          column.width,
          column.align,
        );
      })
      .join("");
    container.appendChild(labels);

    container.appendChild(line("rule")).textContent = repeat("-", width);

    for (var i = 0; i < rowsPerPage; i++) {
      var rowLine = line("row");
      var cells = columns.map(function (column) {
        var span = document.createElement("span");
        span.className = "cell cell-" + column.key;
        span.textContent = repeat(" ", column.width);
        rowLine.appendChild(span);
        return { el: span, width: column.width, align: column.align };
      });
      container.appendChild(rowLine);
      slots.push({ line: rowLine, cells: cells });
    }

    container.appendChild(line("rule")).textContent = repeat("-", width);

    var footer = line("footer");
    container.appendChild(footer);
    container.appendChild(line("spacer")).textContent = "";

    var message = line("message");
    container.appendChild(message);

    function paintFooter() {
      var format = pagination.footerFormat || "PAGE {page} OF {pages}";
      footer.textContent = pad(
        format
          .replace("{page}", String(pageIndex + 1))
          .replace("{pages}", String(pages.length)),
        width,
      );
    }

    function paintSlot(slot, row, tick) {
      slot.line.dataset.flight = row ? row.id : "";
      slot.cells.forEach(function (cell, cellIndex) {
        var source = row ? row.cells[cellIndex] : null;
        cell.source = source;
        cell.row = row || null;
        cell.cellIndex = cellIndex;
        var text = source
          ? cellTextForTick(row, source, cellIndex, state, tick || 0, generative)
          : "";
        cell.el.textContent = source
          ? pad(text, cell.width, cell.align)
          : repeat(" ", cell.width);
      });
    }

    function paintPage(tick) {
      var page = pages[pageIndex] || [];
      slots.forEach(function (slot, slotIndex) {
        paintSlot(slot, page[slotIndex] || null, tick);
      });
      paintFooter();
    }

    function paintMessage(tick) {
      var config = state.messages || {};
      var items = config.items || [];
      if (config.mode === "none" || !items.length) {
        message.textContent = "";
        return;
      }
      if (config.mode === "static") {
        message.textContent = centre(
          transform(items[0], state.transform),
          width,
        );
        return;
      }
      if (config.mode === "rotate") {
        var holdTicks = Math.max(
          1,
          Math.round(
            ((config.holdSeconds || 8) * 1000) / (state.tickMs || 250),
          ),
        );
        var index = Math.floor(tick / holdTicks) % items.length;
        message.textContent = centre(
          transform(items[index], state.transform),
          width,
        );
        return;
      }
      // scroll: one continuous marquee of every message, wrapped seamlessly
      var gap = config.gap == null ? "     ***     " : config.gap;
      var strip = transform(items.join(gap) + gap, state.transform);
      var speed =
        config.speedCharsPerTick == null ? 1 : config.speedCharsPerTick;
      var offset = Math.floor(tick * speed) % strip.length;
      var doubled = strip + strip;
      message.textContent = doubled.slice(offset, offset + width);
    }

    function update(tick) {
      if (generative) {
        paintPage(tick);
      }
      paintMessage(tick);
    }

    paintPage(0);
    paintMessage(0);

    return {
      width: width,
      lineCount: container.childElementCount,
      pageCount: pages.length,
      flightCount: rows.length,
      get pageIndex() {
        return pageIndex;
      },
      setPage: function (index, tick) {
        var count = pages.length;
        pageIndex = ((index % count) + count) % count;
        paintPage(tick || 0);
        return pageIndex;
      },
      nextPage: function (tick) {
        return this.setPage(pageIndex + 1, tick);
      },
      previousPage: function (tick) {
        return this.setPage(pageIndex - 1, tick);
      },
      update: update,
      messageState: messageState,
    };
  }

  global.FIDS = global.FIDS || {};
  global.FIDS.Board = {
    create: createBoard,
    buildRows: buildRows,
    paginate: paginate,
    pad: pad,
    transform: transform,
  };
})(window);

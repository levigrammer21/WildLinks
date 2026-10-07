import {
  CELL,
  GW,
  GH,
  COLORS,
  T,
  landSize,
  dist,
  terrainAt,
  heightAt,
  clamp,
  lerp,
} from "./world.js";
export class Renderer {
  constructor(canvas, s) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.s = s;
    this.w = 0;
    this.h = 0;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.camera = { x: 300, y: 220, zoom: 1 };
    this.target = null;
    this.dirty = true;
    this.terrain = document.createElement("canvas");
    this.terrain.width = GW;
    this.terrain.height = GH;
    this.tctx = this.terrain.getContext("2d");
    this.rawTerrain = document.createElement("canvas");
    this.rawTerrain.width = GW;
    this.rawTerrain.height = GH;
    this.rawContext = this.rawTerrain.getContext("2d");
    this.mode = "watch";
    this.activeHole = 0;
    this.preview = null;
    this.cursor = null;
    this.follow = null;
    this.resize();
    this.frame();
  }
  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  frame() {
    let l = landSize(this.s),
      bottom = this.mode === "build" ? 260 : this.mode === "play" ? 220 : 120,
      usable = Math.max(100, this.h - bottom - 80),
      zoom = Math.min((this.w - 55) / l.w, usable / l.h);
    this.camera = {
      x: l.w / 2,
      y: l.h / 2 + (bottom - 80) / 2 / zoom,
      zoom: clamp(zoom, 0.13, 4),
    };
    this.target = null;
  }
  screen(p) {
    let c = this.camera;
    return {
      x: (p.x - c.x) * c.zoom + this.w / 2,
      y: (p.y - c.y) * c.zoom + this.h / 2,
    };
  }
  world(p) {
    let c = this.camera;
    return {
      x: (p.x - this.w / 2) / c.zoom + c.x,
      y: (p.y - this.h / 2) / c.zoom + c.y,
    };
  }
  zoom(f, anchor = { x: this.w / 2, y: this.h / 2 }) {
    const old = this.world(anchor);
    this.camera.zoom = clamp(this.camera.zoom * f, 0.12, 8);
    let now = this.world(anchor);
    this.camera.x += old.x - now.x;
    this.camera.y += old.y - now.y;
    this.target = null;
  }
  rebuild() {
    let im = this.tctx.createImageData(GW, GH),
      palette = COLORS.map((c) => [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5), 16),
      ]);
    for (let i = 0; i < GW * GH; i++) {
      let t = this.s.terrain[i],
        col = palette[t] || palette[0],
        x = i % GW,
        y = (i / GW) | 0,
        grain =
          Math.sin(x * 0.073) * Math.cos(y * 0.091) * 3 +
          ((((Math.imul(x + 13, y + 31) * 127) >>> 0) % 19) - 9) * 0.16,
        shade = clamp(
          (this.s.heights[i] - this.s.heights[Math.max(0, i - GW - 1)]) * 5,
          -13,
          13,
        );
      if (t === 1 || t === 2 || t === 9)
        grain += Math.floor((x + y) / 6) % 2 ? 2 : -2;
      im.data[i * 4] = col[0] + grain + shade;
      im.data[i * 4 + 1] = col[1] + grain + shade;
      im.data[i * 4 + 2] = col[2] + grain + shade;
      im.data[i * 4 + 3] = 255;
    }
    this.rawContext.putImageData(im, 0, 0);
    this.tctx.clearRect(0, 0, GW, GH);
    this.tctx.filter = "blur(0.7px)";
    this.tctx.drawImage(this.rawTerrain, 0, 0);
    this.tctx.filter = "none";
    this.dirty = false;
  }
  draw(dt, sim) {
    let ctx = this.ctx,
      s = this.s,
      c = this.camera,
      l = landSize(s),
      time = performance.now() / 1000;
    if (this.dirty) this.rebuild();
    let followed = sim.visits.find((v) => v.id === this.follow);
    if (followed && !followed.finished) {
      let p =
        followed.state === "flying"
          ? this.ballPosition(followed)
          : followed.ball;
      let bottom = this.mode === "play" ? 215 : 130,
        cy = p.y + (bottom - 50) / 2 / c.zoom,
        cx = p.x;
      if (this.mode === "play" && followed.state === "ready" && this.preview) {
        const pr = this.preview,
          top = this.h < 520 ? 85 : 165,
          bottomPad = this.h < 520 ? 150 : 245,
          spanX = Math.abs(pr.target.x - p.x) + pr.spread * 4 + 50,
          spanY = Math.abs(pr.target.y - p.y) + pr.depth * 4 + 50,
          fit = Math.min(
            (this.w - 50) / spanX,
            Math.max(90, this.h - top - bottomPad) / spanY,
            pr.putt ? 3 : 1.6,
          );
        c.zoom = lerp(c.zoom, clamp(fit, 0.28, 3), Math.min(1, dt * 3));
        cx = (p.x + pr.target.x) / 2;
        cy = (p.y + pr.target.y) / 2 + (bottomPad - top) / 2 / c.zoom;
      }
      c.x = lerp(c.x, cx, Math.min(1, dt * 5));
      c.y = lerp(c.y, cy, Math.min(1, dt * 5));
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#25473b";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-c.x, -c.y);
    ctx.shadowColor = "#0003";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#385742";
    ctx.fillRect(-8, -8, l.w + 16, l.h + 16);
    ctx.shadowBlur = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, l.w / CELL, l.h / CELL, 0, 0, l.w, l.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, l.w, l.h);
    ctx.clip();
    this.details(ctx, time);
    this.facilities(ctx);
    for (let i = 0; i < s.holes.length; i++)
      this.hole(
        ctx,
        s.holes[i],
        i,
        this.mode === "build" && this.activeHole === i,
      );
    for (const v of sim.visits) if (!v.finished) this.golfer(ctx, v, time);
    if (this.preview) this.shotPreview(ctx, this.preview);
    if (this.cursor && this.mode === "build") {
      ctx.strokeStyle = "#fff8";
      ctx.lineWidth = 1.5 / c.zoom;
      ctx.setLineDash([5 / c.zoom, 4 / c.zoom]);
      ctx.beginPath();
      ctx.arc(this.cursor.x, this.cursor.y, this.cursor.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff12";
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#e4dab076";
    ctx.lineWidth = 2 / c.zoom;
    ctx.setLineDash([12 / c.zoom, 10 / c.zoom]);
    ctx.strokeRect(0, 0, l.w, l.h);
    ctx.setLineDash([]);
    ctx.restore();
    this.compass(ctx);
    if (this.mode === "play" && followed?.state === "ready")
      this.ballHalo(ctx, followed);
  }
  details(ctx, time) {
    const c = this.camera,
      l = landSize(this.s),
      left = clamp(Math.floor((c.x - this.w / (2 * c.zoom)) / 12) * 12, 0, l.w),
      right = clamp(c.x + this.w / (2 * c.zoom) + 12, 0, l.w),
      top = clamp(Math.floor((c.y - this.h / (2 * c.zoom)) / 12) * 12, 0, l.h),
      bottom = clamp(c.y + this.h / (2 * c.zoom) + 12, 0, l.h);
    for (let y = top; y < bottom; y += 12)
      for (let x = left; x < right; x += 12) {
        let t = terrainAt(this.s, { x, y }),
          hash = ((x * 17 + y * 29) % 97) / 97;
        if (t === 7) {
          let xx = x + hash * 6,
            yy = y + hash * 3;
          ctx.fillStyle = "#123a3540";
          ctx.beginPath();
          ctx.ellipse(xx + 5, yy + 5, 10, 6, 0, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#1d543d";
          ctx.beginPath();
          ctx.arc(xx, yy, 8 + hash * 2, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#35764b";
          ctx.beginPath();
          ctx.arc(xx - 2, yy - 3, 6 + hash * 2, 0, 7);
          ctx.fill();
          ctx.fillStyle = "#498854";
          ctx.beginPath();
          ctx.arc(xx - 3, yy - 5, 3, 0, 7);
          ctx.fill();
        } else if (t === 4 && hash > 0.7) {
          ctx.strokeStyle = "#a9dae052";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          let off = Math.sin(time * 0.6 + x) * 2;
          ctx.moveTo(x + off, y);
          ctx.quadraticCurveTo(x + 4 + off, y - 1, x + 8 + off, y);
          ctx.stroke();
        } else if (t === 3 && hash > 0.68) {
          ctx.fillStyle = "#b9975a70";
          ctx.fillRect(x, y, 1, 1);
        } else if (t === 8) {
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = ["#f6ce72", "#d59ea3", "#d9dec8"][i];
            ctx.beginPath();
            ctx.arc(x + i * 3, y + (i % 2) * 4, 1.8, 0, 7);
            ctx.fill();
          }
        } else if (t === 0 && hash > 0.89 && c.zoom > 0.7) {
          ctx.strokeStyle = "#3c6e4360";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 1, y - 3);
          ctx.moveTo(x + 2, y);
          ctx.lineTo(x + 3, y - 2);
          ctx.stroke();
        }
        if (
          c.zoom > 0.5 &&
          Math.abs(heightAt(this.s, { x, y })) > 2 &&
          Math.floor(heightAt(this.s, { x, y }) / 2) !==
            Math.floor(heightAt(this.s, { x: x + 12, y }) / 2)
        ) {
          ctx.strokeStyle = "#153f2425";
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 12);
          ctx.stroke();
        }
      }
  }
  facilities(ctx) {
    let buildings = [
      { id: "check", name: "CHECK-IN", x: 38, y: 30 },
      ...this.s.facilities.map((id, i) => ({
        id,
        name: id.toUpperCase(),
        x: 38 + (i % 4) * 42,
        y: 72 + Math.floor(i / 4) * 38,
      })),
    ];
    ctx.fillStyle = "#bcab83";
    ctx.fillRect(0, 42, 55, 10);
    for (const b of buildings) {
      ctx.fillStyle = "#102a3040";
      ctx.fillRect(b.x - 13, b.y - 8, 33, 24);
      ctx.fillStyle = "#d9d3b3";
      ctx.fillRect(b.x - 16, b.y - 13, 30, 21);
      ctx.fillStyle = b.id === "check" ? "#785d44" : "#476c68";
      ctx.beginPath();
      ctx.moveTo(b.x - 19, b.y - 14);
      ctx.lineTo(b.x - 2, b.y - 24);
      ctx.lineTo(b.x + 17, b.y - 14);
      ctx.lineTo(b.x + 14, b.y - 8);
      ctx.lineTo(b.x - 16, b.y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#285144";
      ctx.fillRect(b.x - 6, b.y - 5, 7, 13);
      ctx.fillStyle = "#8eb5b2";
      ctx.fillRect(b.x + 5, b.y - 5, 6, 5);
      if (this.camera.zoom > 0.8) {
        ctx.font = "bold 6px system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e8e9ca";
        ctx.fillText(b.name, b.x, b.y + 19);
      }
    }
  }
  hole(ctx, h, i, selected) {
    let z = this.camera.zoom;
    if (selected && h.tee && h.pin) {
      ctx.strokeStyle = "#ffe69a65";
      ctx.lineWidth = 1.5 / z;
      ctx.setLineDash([8 / z, 7 / z]);
      ctx.beginPath();
      ctx.moveTo(h.tee.x, h.tee.y);
      ctx.lineTo(h.pin.x, h.pin.y);
      ctx.stroke();
      ctx.setLineDash([]);
      let m = { x: (h.tee.x + h.pin.x) / 2, y: (h.tee.y + h.pin.y) / 2 };
      this.label(
        ctx,
        `${Math.round(dist(h.tee, h.pin))} yd · Par ${h.par}`,
        m.x,
        m.y - 12,
        "#122e29c9",
      );
    }
    if (h.tee) {
      ctx.fillStyle = "#59864b";
      ctx.beginPath();
      ctx.ellipse(h.tee.x, h.tee.y, 9, 5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#f2ce78";
      ctx.fillRect(h.tee.x - 6, h.tee.y - 2, 2, 2);
      ctx.fillRect(h.tee.x + 5, h.tee.y - 2, 2, 2);
      this.label(
        ctx,
        String(i + 1),
        h.tee.x,
        h.tee.y + 19,
        h.open ? "#173a30" : "#6d6244",
      );
    }
    if (h.pin) {
      ctx.fillStyle = "#244e31";
      ctx.beginPath();
      ctx.ellipse(h.pin.x, h.pin.y, 1.5, 0.9, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#e8e5ca";
      ctx.lineWidth = Math.max(0.9, 1 / z);
      ctx.beginPath();
      ctx.moveTo(h.pin.x, h.pin.y);
      ctx.lineTo(h.pin.x, h.pin.y - 20);
      ctx.stroke();
      ctx.fillStyle = h.open ? "#f5cd72" : "#dce1c9";
      ctx.beginPath();
      ctx.moveTo(h.pin.x, h.pin.y - 20);
      ctx.lineTo(h.pin.x + 10, h.pin.y - 16);
      ctx.lineTo(h.pin.x, h.pin.y - 12);
      ctx.closePath();
      ctx.fill();
    } else if (h.green && selected) {
      this.label(ctx, "Place pin", h.green.x, h.green.y, "#122e29");
    }
    if (selected && !h.tee) {
      const p = { x: 110, y: 320 };
      ctx.strokeStyle = "#f2ce7880";
      ctx.lineWidth = 2 / z;
      ctx.setLineDash([4 / z, 5 / z]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 / z, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
      this.label(ctx, "Place tee", p.x, p.y + 30 / z, "#122e29bd");
    }
  }
  label(ctx, text, x, y, color) {
    let z = this.camera.zoom;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / z, 1 / z);
    ctx.font = "600 11px system-ui";
    let w = ctx.measureText(text).width + 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -10, w, 22, 8);
    ctx.fill();
    ctx.fillStyle = "#fff3ce";
    ctx.textAlign = "center";
    ctx.fillText(text, 0, 5);
    ctx.restore();
  }
  ballPosition(v) {
    if (v.state !== "flying" || !v.shot) return v.ball;
    let path = v.shot.path,
      t = clamp(v.timer / v.shot.duration, 0, 1) * (path.length - 1),
      i = Math.floor(t),
      a = path[i],
      b = path[Math.min(path.length - 1, i + 1)];
    return {
      x: lerp(a.x, b.x, t - i),
      y: lerp(a.y, b.y, t - i),
      z: lerp(a.z, b.z, t - i),
    };
  }
  golfer(ctx, v, time) {
    let z = this.camera.zoom,
      p = v.pos,
      selected = this.follow === v.id,
      size = clamp(3 / z, 3, 7);
    if (selected) {
      ctx.strokeStyle = "#ffe6a69a";
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11 / z, 0, 7);
      ctx.stroke();
    }
    if (v.plan && selected && v.state === "thinking") {
      ctx.strokeStyle = "#ffffb970";
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([4 / z, 5 / z]);
      ctx.beginPath();
      ctx.moveTo(v.ball.x, v.ball.y);
      ctx.lineTo(v.plan.target.x, v.plan.target.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(v.plan.target.x, v.plan.target.y, 5 / z, 0, 7);
      ctx.stroke();
    }
    ctx.fillStyle = "#16392c70";
    ctx.beginPath();
    ctx.ellipse(p.x + size * 0.3, p.y + size * 0.7, size, size * 0.45, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#27362e";
    let leg = v.state === "walking" ? Math.sin(time * 10) * size * 0.4 : 0;
    ctx.fillRect(
      p.x - size * 0.55,
      p.y + size * 0.3,
      size * 0.4,
      size * 0.7 + leg,
    );
    ctx.fillRect(
      p.x + size * 0.1,
      p.y + size * 0.3,
      size * 0.4,
      size * 0.7 - leg,
    );
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, size * 0.65, size, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#e8bf93";
    ctx.beginPath();
    ctx.arc(p.x, p.y - size * 1.1, size * 0.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fbf5db";
    ctx.fillRect(p.x - size * 0.55, p.y - size * 1.65, size * 1.2, size * 0.35);
    ctx.strokeStyle = "#b2c7b6";
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    let swing =
      v.state === "flying"
        ? Math.sin(Math.min(1, v.timer / 0.35) * Math.PI) * 2
        : 0;
    ctx.moveTo(p.x + size * 0.5, p.y);
    ctx.lineTo(
      p.x + size * 1.5 + Math.sin(swing) * size,
      p.y + size * (1 - swing),
    );
    ctx.stroke();
    let b = this.ballPosition(v);
    ctx.fillStyle = "#203d3755";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 2.2 / z, 1.2 / z, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fffce8";
    ctx.shadowColor = "#0004";
    ctx.shadowBlur = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y - (b.z || 0) * 0.55, Math.max(1.6, 2.8 / z), 0, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (v.state === "flying" && selected) {
      const path = v.shot.path,
        t = clamp(v.timer / v.shot.duration, 0, 1);
      ctx.strokeStyle = "#fff2";
      ctx.lineWidth = 1.5 / z;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length * t; i++)
        ctx.lineTo(path[i].x, path[i].y - path[i].z * 0.55);
      ctx.stroke();
    }
  }
  shotPreview(ctx, pr) {
    let z = this.camera.zoom,
      start = pr.start,
      end = pr.target;
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(pr.angle);
    ctx.fillStyle = "#fff4c333";
    ctx.strokeStyle = "#fff3bb99";
    ctx.lineWidth = 1.2 / z;
    ctx.setLineDash([4 / z, 4 / z]);
    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      Math.max(pr.depth * 2, 3 / z),
      Math.max(pr.spread * 2, 3 / z),
      0,
      0,
      7,
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#ffefb0b0";
    ctx.lineWidth = 2 / z;
    ctx.setLineDash([5 / z, 5 / z]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    if (pr.putt) ctx.lineTo(end.x, end.y);
    else
      ctx.quadraticCurveTo(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2 - dist(start, end) * 0.13,
        end.x,
        end.y,
      );
    ctx.stroke();
    ctx.setLineDash([]);
    this.label(
      ctx,
      `~${Math.round(pr.range)} yd`,
      end.x,
      end.y - 20 / z,
      "#173b32dd",
    );
  }
  ballHalo(ctx, v) {
    let p = this.screen(v.ball);
    ctx.strokeStyle = "#f2ce78a0";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  compass(ctx) {
    ctx.save();
    ctx.translate(
      this.w - 34,
      this.h - (this.mode === "build" ? 285 : this.mode === "play" ? 250 : 105),
    );
    ctx.strokeStyle = "#f3eed878";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -10);
    ctx.moveTo(-4, -5);
    ctx.lineTo(0, -10);
    ctx.lineTo(4, -5);
    ctx.stroke();
    ctx.fillStyle = "#f3eed8a0";
    ctx.textAlign = "center";
    ctx.font = "10px system-ui";
    ctx.fillText("N", 0, -16);
    ctx.restore();
  }
}

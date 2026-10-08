import { DECORATIONS } from "./life.js";
export function drawDecorations(ctx, s, time) {
  for (const d of s.decorations || []) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(((d.angle || 0) * Math.PI) / 180);
    ctx.fillStyle = "#133e3045";
    ctx.fillRect(-17, 8, 38, 12);
    if (d.type === "stand") {
      ctx.fillStyle = "#6d827d";
      ctx.fillRect(-25, -15, 50, 34);
      ctx.fillStyle = "#d5d4b4";
      ctx.fillRect(-24, -17, 48, 5);
      ctx.fillStyle = "#586c68";
      ctx.fillRect(-25, 18, 50, 5);
      for (let row = 0; row < 2; row++) {
        ctx.fillStyle = "#d9aa64";
        ctx.fillRect(-23, row * 9, 46, 5);
      }
      ctx.strokeStyle = "#dedfcb";
      ctx.lineWidth = 2;
      ctx.strokeRect(-25, -17, 50, 35);
      ctx.fillStyle = "#f2ce78";
      ctx.fillRect(-26, -27, 3, 12);
      ctx.beginPath();
      ctx.moveTo(-23, -27);
      ctx.lineTo(-11, -24);
      ctx.lineTo(-23, -21);
      ctx.fill();
    } else if (d.type === "bridge") {
      ctx.fillStyle = "#8a6948";
      ctx.fillRect(-42, -9, 84, 18);
      ctx.strokeStyle = "#bb9668";
      ctx.lineWidth = 1;
      for (let x = -40; x < 42; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, -9);
        ctx.lineTo(x, 9);
        ctx.stroke();
      }
      ctx.strokeStyle = "#eed3a0";
      ctx.lineWidth = 2;
      ctx.strokeRect(-42, -9, 84, 18);
    } else if (d.type === "bench") {
      ctx.fillStyle = "#314940";
      ctx.fillRect(-11, 6, 3, 7);
      ctx.fillRect(8, 6, 3, 7);
      ctx.fillStyle = "#d7a464";
      ctx.fillRect(-14, -4, 28, 4);
      ctx.fillRect(-14, 3, 28, 6);
    } else if (d.type === "planter") {
      ctx.fillStyle = "#b27755";
      ctx.fillRect(-9, -6, 18, 14);
      ctx.fillStyle = "#527d3f";
      ctx.beginPath();
      ctx.ellipse(0, -7, 11, 6, 0, 0, 7);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ["#f5d479", "#d89bcc", "#ece5c7"][i % 3];
        ctx.beginPath();
        ctx.arc(Math.sin(i * 3) * 7, -7 + Math.cos(i * 3) * 4, 2.5, 0, 7);
        ctx.fill();
      }
    } else if (d.type === "rock") {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ["#7b8e7c", "#9baa91", "#bdc2a1"][i];
        ctx.beginPath();
        ctx.ellipse((i - 1) * 8, (i % 2) * 4, 9 - i, 6, -0.3, 0, 7);
        ctx.fill();
      }
    } else if (d.type === "fountain") {
      ctx.fillStyle = "#b8bca3";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 11, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#75b6be";
      ctx.beginPath();
      ctx.ellipse(0, -2, 14, 8, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#dbf3ef";
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.quadraticCurveTo(i * 7, -23 - Math.sin(time * 3) * 2, i * 11, 0);
        ctx.stroke();
      }
    } else if (d.type === "arch") {
      ctx.strokeStyle = "#dbd3ac";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-12, 10);
      ctx.lineTo(-12, -8);
      ctx.bezierCurveTo(-12, -27, 12, -27, 12, -8);
      ctx.lineTo(12, 10);
      ctx.stroke();
      ctx.strokeStyle = "#75a34e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-12, 5);
      ctx.bezierCurveTo(-20, -26, 18, -28, 12, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#725839";
      ctx.fillRect(-1, 0, 3, 14);
      ctx.fillStyle = "#f1d58b";
      ctx.fillRect(-13, -14, 26, 16);
      ctx.fillStyle = "#315144";
      ctx.font = "bold 6px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("WILD", 0, -5);
    }
    ctx.restore();
  }
}
function person(ctx, p, color, cheer = false, hat = true) {
  ctx.fillStyle = "#153e3145";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 4, 2, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#243b32";
  ctx.fillRect(p.x - 2, p.y + 2, 1.5, 4);
  ctx.fillRect(p.x + 0.5, p.y + 2, 1.5, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - 2.5, p.y - 3, 5, 7);
  ctx.fillStyle = "#e6bd95";
  ctx.beginPath();
  ctx.arc(p.x, p.y - 5, 2, 0, 7);
  ctx.fill();
  if (hat) {
    ctx.fillStyle = "#f3e5bd";
    ctx.fillRect(p.x - 2.5, p.y - 7, 5, 1.5);
  }
  if (cheer) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x - 2, p.y);
    ctx.lineTo(p.x - 6, p.y - 6);
    ctx.moveTo(p.x + 2, p.y);
    ctx.lineTo(p.x + 6, p.y - 6);
    ctx.stroke();
  }
}
function boat(ctx, p) {
  ctx.fillStyle = "#b38b5c";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 11, 5, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "#d6eedc88";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 6, 14, 6, 0, 0, 7);
  ctx.stroke();
}
export function drawPeople(ctx, sim, time, renderer) {
  const colors = {
    grounds: "#daca76",
    desk: "#d7b6bb",
    mechanic: "#829baa",
    pro: "#f5efdc",
    service: "#cda2cf",
  };
  for (const w of sim.s.workers || []) {
    if (w.mower && w.stage !== "waiting" && w.travelMode !== "ferry") {
      if (w.trail?.length) {
        ctx.strokeStyle = "#a1c77755";
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let i = 0; i < w.trail.length; i++)
          i
            ? ctx.lineTo(w.trail[i].x, w.trail[i].y)
            : ctx.moveTo(w.trail[i].x, w.trail[i].y);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(w.pos.x, w.pos.y);
      ctx.rotate(w.heading || 0);
      ctx.fillStyle = "#233e31";
      ctx.fillRect(-7, -7, 4, 4);
      ctx.fillRect(-7, 3, 4, 4);
      ctx.fillRect(5, -6, 3, 3);
      ctx.fillRect(5, 3, 3, 3);
      ctx.fillStyle = "#a9bf61";
      ctx.fillRect(-5, -5, 13, 10);
      ctx.fillStyle = "#e6cc76";
      ctx.fillRect(3, -3, 6, 6);
      ctx.restore();
      person(ctx, { x: w.pos.x - 2, y: w.pos.y - 3 }, colors[w.role]);
    } else {
      if (w.travelMode === "ferry") boat(ctx, w.pos);
      person(ctx, w.pos, colors[w.role]);
    }
  }
  for (const f of sim.s.fans || []) {
    if (f.travelMode === "ferry") boat(ctx, f.pos);
    person(
      ctx,
      f.pos,
      ["#eea281", "#99bdce", "#d7c58a", "#c6a4ce"][f.seat % 4],
      f.cheer > 0,
      false,
    );
  }
  for (const e of sim.effects || []) {
    const k = e.age / e.duration;
    ctx.globalAlpha = 1 - k;
    if (e.kind === "water") {
      ctx.strokeStyle = "#d7f4ef";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 4 + 16 * k, 2 + 8 * k, 0, 0, 7);
      ctx.stroke();
    } else {
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle =
          e.kind === "sand"
            ? "#ecd09b"
            : e.kind === "leaves"
              ? "#72a34d"
              : e.kind === "spark"
                ? "#ffe4a2"
                : "#d6e5c0";
        ctx.beginPath();
        ctx.arc(
          e.x + Math.cos(i * 2.4) * (3 + 12 * k),
          e.y + Math.sin(i * 2.4) * (3 + 9 * k) - 8 * Math.sin(k * Math.PI),
          1.4,
          0,
          7,
        );
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
export function drawGolferExtra(ctx, v, renderer, time) {
  const p = v.pos,
    z = renderer.camera.zoom;
  if (v.travelMode === "ferry") boat(ctx, p);
  if (["walking", "between", "goingRange"].includes(v.state)) {
    ctx.fillStyle = "#997956";
    ctx.save();
    ctx.translate(p.x + 4, p.y);
    ctx.rotate(-0.2);
    ctx.fillRect(0, -3, 3, 8);
    ctx.restore();
  }
  if (v.reactionLeft > 0) {
    ctx.strokeStyle = v.color;
    ctx.lineWidth = Math.max(1, 1.5 / z);
    ctx.beginPath();
    if (v.reaction === "celebrate") {
      ctx.moveTo(p.x - 2, p.y);
      ctx.lineTo(p.x - 8, p.y - 9);
      ctx.moveTo(p.x + 2, p.y);
      ctx.lineTo(p.x + 8, p.y - 9);
    } else if (v.reaction === "disappointed") {
      ctx.moveTo(p.x - 3, p.y - 1);
      ctx.lineTo(p.x - 7, p.y + 1);
      ctx.moveTo(p.x + 3, p.y - 1);
      ctx.lineTo(p.x + 7, p.y + 1);
    }
    ctx.stroke();
    if (renderer.follow === v.id)
      renderer.label(
        ctx,
        v.reaction === "celebrate"
          ? "In the cup!"
          : v.reaction === "disappointed"
            ? "Ah, trouble."
            : v.reaction === "pleased"
              ? "Lovely shot!"
              : "Settled.",
        p.x,
        p.y - 25 / z,
        "#14382bd9",
      );
  }
}

// Firebase's public REST APIs keep the static game dependency-free and playable offline.
export const firebaseConfig = {
  apiKey: "AIzaSyBhGI155io6xE1nAejVvBS3JCuRdhdwFPs",
  authDomain: "wildlinks-1de54.firebaseapp.com",
  projectId: "wildlinks-1de54",
  storageBucket: "wildlinks-1de54.firebasestorage.app",
  messagingSenderId: "226919092509",
  appId: "1:226919092509:web:b15aa92c964779486291f4",
};
const SESSION = "wild-links-account",
  BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const field = (v) =>
  typeof v === "number"
    ? { integerValue: String(v) }
    : { stringValue: String(v) };
export function validateRegistration(email, password, confirmation) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw Error("Enter a valid email address.");
  if (password !== confirmation) throw Error("Passwords do not match.");
  if (password.length < 6)
    throw Error("Use a password with at least 6 characters.");
}
export function splitSnapshot(raw) {
  const parts = [];
  for (let i = 0; i < raw.length; i += 100000)
    parts.push(raw.slice(i, i + 100000));
  return parts;
}
export function authMessage(code) {
  const errors = {
    EMAIL_EXISTS: "That email already has an account. Sign in instead.",
    INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
    INVALID_PASSWORD: "Email or password is incorrect.",
    EMAIL_NOT_FOUND: "Email or password is incorrect.",
    OPERATION_NOT_ALLOWED:
      "Enable Email/Password in Firebase Authentication → Sign-in method.",
    PERMISSION_DENIED:
      "Cloud access denied. Publish the supplied firestore.rules in Firebase.",
    USER_DISABLED: "This account has been disabled.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Please try again later.",
    API_KEY_INVALID: "Firebase rejected the project key.",
    INVALID_REFRESH_TOKEN: "Please sign in again.",
    TOKEN_EXPIRED: "Please sign in again.",
  };
  return errors[code] || code.replaceAll("_", " ").split(" : ")[0];
}
export class CloudStore {
  constructor({
    storage = globalThis.localStorage,
    fetcher = (...args) => globalThis.fetch(...args),
    onStatus = () => {},
    onUser = () => {},
  } = {}) {
    this.storage = storage;
    this.fetcher = fetcher;
    this.onStatus = onStatus;
    this.onUser = onUser;
    this.session = null;
    this.running = false;
    this.pending = null;
    this.backlog = new Map();
    this.ready = false;
    this.blocked = new Set();
    this.timer = null;
    this.generation = 0;
    this.status = "Local save";
    try {
      this.session = JSON.parse(storage.getItem(SESSION));
    } catch {}
  }
  setStatus(status) {
    this.status = status;
    this.onStatus(status);
  }
  async request(url, options = {}) {
    let r;
    try {
      r = await this.fetcher(url, {
        ...options,
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw Error(
        "Connection unavailable. Your course is saved on this device.",
      );
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code =
        data.error?.status || data.error?.message || "Cloud request failed";
      const error = Error(authMessage(code));
      error.code = code;
      error.http = r.status;
      throw error;
    }
    return data;
  }
  persistSession() {
    this.storage.setItem(SESSION, JSON.stringify(this.session));
  }
  async login(email, password, confirmation, register = false) {
    if (register) validateRegistration(email, password, confirmation);
    if (!email.trim() || !password)
      throw Error("Enter your email and password.");
    const action = register ? "signUp" : "signInWithPassword";
    const d = await this.request(
      `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          returnSecureToken: true,
        }),
      },
    );
    this.session = {
      uid: d.localId,
      email: d.email || email.trim(),
      idToken: d.idToken,
      refreshToken: d.refreshToken,
      expires: Date.now() + Number(d.expiresIn) * 1000,
    };
    this.persistSession();
    this.generation++;
    this.blocked.clear();
    this.setStatus("Connecting");
    await this.onUser(this.session);
    return this.session;
  }
  async resetPassword(email) {
    if (!email.trim()) throw Error("Enter your email first.");
    await this.request(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email: email.trim(),
        }),
      },
    );
  }
  async token() {
    if (!this.session) throw Error("Sign in to sync courses.");
    if (this.session.expires < Date.now() + 60000) {
      const d = await this.request(
        `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: this.session.refreshToken,
          }).toString(),
        },
      );
      this.session.idToken = d.id_token;
      this.session.refreshToken = d.refresh_token;
      this.session.expires = Date.now() + Number(d.expires_in) * 1000;
      this.persistSession();
    }
    return this.session.idToken;
  }
  async doc(path, method = "GET", fields = null, precondition = null) {
    const token = await this.token();
    const query =
      precondition === null
        ? ""
        : precondition
          ? `?currentDocument.updateTime=${encodeURIComponent(precondition)}`
          : "?currentDocument.exists=false";
    return this.request(BASE + "/" + path + query, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(fields ? { body: JSON.stringify({ fields }) } : {}),
    });
  }
  root(id) {
    return `users/${this.session.uid}/courses/${id}`;
  }
  async list() {
    let documents = [],
      pageToken = "";
    do {
      const token = await this.token();
      const result = await this.request(
        BASE +
          `/users/${this.session.uid}/courses?pageSize=100` +
          (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
        { headers: { Authorization: "Bearer " + token } },
      );
      documents.push(...(result.documents || []));
      pageToken = result.nextPageToken || "";
    } while (pageToken);
    return documents.map((d) => ({
      id: d.name.split("/").pop(),
      name: d.fields.name.stringValue,
      updateTime: d.updateTime,
      revision: d.fields.revision.stringValue,
      chunks: Number(d.fields.chunks.integerValue),
      updated: Number(d.fields.savedAt.integerValue),
      day: Number(d.fields.day?.integerValue || 1),
      holes: Number(d.fields.holes?.integerValue || 0),
      player: d.fields.golfer?.stringValue
        ? JSON.parse(d.fields.golfer.stringValue)
        : null,
      xp: Number(d.fields.xp?.integerValue || 0),
      previous: d.fields.previous?.stringValue || "",
      previousChunks: Number(d.fields.previousChunks?.integerValue || 0),
    }));
  }
  async load(meta) {
    const path = this.root(meta.id);
    const chunks = [];
    for (let i = 0; i < meta.chunks; i++) {
      const d = await this.doc(path + `/snapshots/${meta.revision}_${i}`);
      chunks.push(d.fields.data.stringValue);
    }
    return chunks.join("");
  }
  queue(state, raw, immediate = false) {
    if (!this.session) return;
    if (this.pending && this.pending.id !== state.courseId)
      this.backlog.set(this.pending.id, this.pending);
    this.pending = {
      id: state.courseId,
      raw,
      name: state.name,
      day: state.day,
      holes: state.holes.filter((h) => h.open).length,
      base: state.cloudBase || null,
      player: JSON.stringify(state.player),
      xp: state.player.xp,
      session: this.session.uid,
      generation: this.generation,
    };
    if (this.blocked.has(state.courseId)) {
      this.setStatus("Choose save");
      return;
    }
    this.setStatus(
      globalThis.navigator?.onLine === false
        ? "Offline · saved locally"
        : "Sync pending",
    );
    if (!this.timer || immediate) {
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => {
          this.timer = null;
          this.flush();
        },
        immediate ? 0 : 8000,
      );
    }
  }
  async flush() {
    if (
      this.running ||
      !this.ready ||
      !this.pending ||
      !this.session ||
      this.blocked.has(this.pending.id)
    )
      return;
    this.running = true;
    const job = this.pending;
    this.pending = null;
    const revision =
        globalThis.crypto?.randomUUID?.() ||
        Date.now().toString(36) + Math.random().toString(36).slice(2),
      parts = splitSnapshot(job.raw),
      root = this.root(job.id);
    this.setStatus("Syncing");
    try {
      for (let i = 0; i < parts.length; i++) {
        if (job.generation !== this.generation)
          throw Error("Account changed. Local save kept.");
        await this.doc(
          root + `/snapshots/${revision}_${i}`,
          "PATCH",
          { data: field(parts[i]) },
          "",
        );
      }
      if (job.generation !== this.generation)
        throw Error("Account changed. Local save kept.");
      const previous = this.bases?.[job.id] || null;
      const d = await this.doc(
        root,
        "PATCH",
        {
          name: field(job.name),
          revision: field(revision),
          chunks: field(parts.length),
          savedAt: field(Date.now()),
          day: field(job.day),
          holes: field(job.holes),
          golfer: field(job.player),
          xp: field(job.xp),
          previous: field(previous?.revision || ""),
          previousChunks: field(previous?.chunks || 0),
        },
        job.base || "",
      );
      const meta = {
        id: job.id,
        name: job.name,
        revision,
        chunks: parts.length,
        updateTime: d.updateTime,
        updated: Date.now(),
        day: job.day,
        holes: job.holes,
        player: JSON.parse(job.player),
        xp: job.xp,
        previous: previous?.revision || "",
        previousChunks: previous?.chunks || 0,
      };
      if (job.generation !== this.generation) return;
      this.bases ||= {};
      this.bases[job.id] = meta;
      await this.onSaved?.(meta);
      if (this.pending?.id === job.id) this.pending.base = d.updateTime;
      if (this.backlog.has(job.id))
        this.backlog.get(job.id).base = d.updateTime;
      this.lastError = "";
      this.setStatus("Cloud saved");
      if (previous?.previous)
        for (let i = 0; i < previous.previousChunks; i++)
          await this.doc(
            root + `/snapshots/${previous.previous}_${i}`,
            "DELETE",
          ).catch(() => {});
    } catch (e) {
      if (job.generation !== this.generation) return;
      if (
        e.http === 409 ||
        e.http === 412 ||
        e.code === "FAILED_PRECONDITION" ||
        e.code === "ALREADY_EXISTS"
      ) {
        this.blocked.add(job.id);
        this.setStatus("Choose save");
        this.onConflict?.(job.id);
        for (let i = 0; i < parts.length; i++)
          await this.doc(root + `/snapshots/${revision}_${i}`, "DELETE").catch(
            () => {},
          );
      } else {
        if (!this.pending && job.generation === this.generation)
          this.pending = job;
        this.setStatus(
          e.code === "PERMISSION_DENIED"
            ? "Cloud rules needed"
            : globalThis.navigator?.onLine === false
              ? "Offline · saved locally"
              : "Sync failed · local safe",
        );
        this.lastError = e.message;
      }
    } finally {
      this.running = false;
      if (!this.pending && this.backlog.size) {
        const next = [...this.backlog.values()].find(
          (j) => !this.blocked.has(j.id),
        );
        if (next) {
          this.pending = next;
          this.backlog.delete(next.id);
        }
      }
      if (
        this.pending &&
        !this.blocked.has(this.pending.id) &&
        this.status === "Cloud saved"
      )
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush();
        }, 8000);
    }
  }
  async signOut() {
    clearTimeout(this.timer);
    this.generation++;
    this.pending = null;
    this.backlog.clear();
    this.session = null;
    this.blocked.clear();
    this.bases = {};
    this.storage.removeItem(SESSION);
    this.setStatus("Local save");
    await this.onUser(null);
  }
}

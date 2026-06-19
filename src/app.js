(function () {
  const story = window.GALGAME_STORY;
  const gameplay = story.gameplay;
  const archiveKey = `${story.saveKey}-archive`;
  const els = {
    bg: document.getElementById("scene-bg"),
    title: document.getElementById("title-screen"),
    titleBg: document.getElementById("title-bg"),
    titleStart: document.getElementById("title-start-btn"),
    titleContinue: document.getElementById("title-continue-btn"),
    titleArchive: document.getElementById("title-archive-btn"),
    titleStatus: document.getElementById("title-status"),
    character: document.getElementById("character-art"),
    route: document.getElementById("route-label"),
    chapter: document.getElementById("chapter-title"),
    progress: document.getElementById("progress-label"),
    speaker: document.getElementById("speaker"),
    mood: document.getElementById("mood"),
    portraitFrame: document.getElementById("portrait-frame"),
    portrait: document.getElementById("portrait-art"),
    expression: document.getElementById("expression-label"),
    text: document.getElementById("line-text"),
    choices: document.getElementById("choices"),
    auto: document.getElementById("auto-btn"),
    save: document.getElementById("save-btn"),
    load: document.getElementById("load-btn"),
    archive: document.getElementById("archive-btn"),
    archiveDialog: document.getElementById("archive-dialog"),
    archiveClose: document.getElementById("archive-close-btn"),
    archiveFilters: document.getElementById("archive-filters"),
    collectionList: document.getElementById("collection-list"),
    reviewList: document.getElementById("review-list"),
    profileList: document.getElementById("profile-list"),
    memoryList: document.getElementById("memory-list"),
    sceneList: document.getElementById("scene-list"),
    epilogueList: document.getElementById("epilogue-list"),
    endingList: document.getElementById("ending-list"),
    restart: document.getElementById("restart-btn"),
    saveStatus: document.getElementById("save-status"),
    advanceHint: document.getElementById("advance-hint"),
    panel: document.querySelector(".novel-panel"),
    calendar: document.getElementById("calendar-label"),
    ap: document.getElementById("ap-label"),
    money: document.getElementById("money-label"),
    memory: document.getElementById("memory-label"),
    statGrid: document.getElementById("stat-grid"),
    heartGrid: document.getElementById("heart-grid"),
    inventoryGrid: document.getElementById("inventory-grid")
  };

  let currentId = story.start;
  let state = clone(gameplay.initialState);
  let auto = false;
  let timer = null;
  let feedbackText = "尚未保存";
  let titleVisible = true;
  let replayOriginId = null;
  let replayOriginState = null;
  let replayOriginTitleVisible = false;
  let archiveFilter = "all";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min = 0, max = 99) {
    return Math.max(min, Math.min(max, value));
  }

  function nodeIds() {
    return Object.keys(story.nodes);
  }

  function resolveAsset(kind, key) {
    if (!key) return "";
    const group = story.assets[kind] || {};
    return group[key] || "";
  }

  function inferPortrait(node) {
    if (node.portrait) return node.portrait;
    const haystack = `${node.route || ""} ${node.chapter || ""} ${node.speaker || ""}`;
    if (haystack.includes("雾岛遥")) {
      if (haystack.includes("旧书店") || haystack.includes("周末")) return "harukaSoftSmile";
      if (haystack.includes("送礼") || haystack.includes("钢笔") || haystack.includes("借笔")) return "harukaBlush";
      return "harukaQuiet";
    }
    if (haystack.includes("白石葵")) {
      if (haystack.includes("奶茶")) return "aoiMilkTea";
      if (haystack.includes("河边") || haystack.includes("转学")) return "aoiTearSmile";
      return "aoiTender";
    }
    if (haystack.includes("椎名冬子")) {
      if (haystack.includes("便利店") || haystack.includes("夜班")) return "fuyukoWorkWarm";
      if (haystack.includes("送礼") || haystack.includes("谢谢") || haystack.includes("咖啡")) return "fuyukoFlustered";
      return "fuyukoComposed";
    }
    return "";
  }

  function setImage(img, src, label) {
    img.classList.remove("is-ready");
    if (!src) {
      img.removeAttribute("src");
      img.alt = "";
      return;
    }
    img.onload = () => img.classList.add("is-ready");
    img.onerror = () => img.classList.remove("is-ready");
    img.src = src;
    img.alt = label || "";
  }

  function formatMoney(value) {
    return `¥${value}`;
  }

  function heroFlag(prefix, hero) {
    return `${prefix}${hero[0].toUpperCase()}${hero.slice(1)}`;
  }

  function applyBucket(bucket, changes) {
    if (!changes) return;
    Object.entries(changes).forEach(([key, delta]) => {
      bucket[key] = clamp((bucket[key] || 0) + delta, 0, 99);
    });
  }

  function applyEffects(effects) {
    if (!effects) return;
    state.money = Math.max(0, state.money + (effects.money || 0));
    applyBucket(state.stats, effects.stats);
    applyBucket(state.affection, effects.affection);
    applyBucket(state.trust, effects.trust);
    if (effects.flags) {
      Object.assign(state.flags, effects.flags);
    }
    if (effects.memories) {
      state.memories = state.memories || [];
      effects.memories.forEach((memory) => {
        if (!state.memories.includes(memory)) state.memories.push(memory);
      });
    }
  }

  function setFeedback(text) {
    feedbackText = text;
    els.saveStatus.textContent = feedbackText;
  }

  function setAdvanceHint(text) {
    if (els.advanceHint) els.advanceHint.textContent = text;
  }

  function pickFeedback(type, key = "", replacements = {}) {
    const group = gameplay.feedback?.[type];
    const list = Array.isArray(group) ? group : group?.[key];
    if (!list?.length) return "";
    const basis = `${state.day}-${state.ap}-${currentId}-${type}-${key}`;
    const index = [...basis].reduce((sum, char) => sum + char.charCodeAt(0), 0) % list.length;
    return list[index].replace(/\{(\w+)\}/g, (_, name) => replacements[name] ?? "");
  }

  function renderStatus() {
    els.calendar.textContent = `第 ${state.day} 天 / ${weekdayLabel()}`;
    els.ap.textContent = `行动点 ${state.ap} / ${gameplay.maxAP}`;
    els.money.textContent = formatMoney(state.money);
    els.memory.textContent = `回忆 ${(state.memories || []).length}`;
    els.saveStatus.textContent = feedbackText;

    els.statGrid.innerHTML = "";
    Object.entries(gameplay.stats).forEach(([key, label]) => {
      const item = document.createElement("div");
      item.className = "stat-pill";
      item.innerHTML = `<span>${label}</span><strong>${state.stats[key] || 0}</strong>`;
      els.statGrid.appendChild(item);
    });

    els.heartGrid.innerHTML = "";
    Object.entries(gameplay.heroines).forEach(([key, hero]) => {
      const item = document.createElement("div");
      item.className = "heart-pill";
      item.innerHTML = `<span>${hero.name}</span><strong>好感 ${state.affection[key] || 0} / 信任 ${state.trust[key] || 0}</strong>`;
      els.heartGrid.appendChild(item);
    });

    els.inventoryGrid.innerHTML = "";
    const inventoryEntries = Object.entries(gameplay.gifts).filter(([key]) => (state.inventory?.[key] || 0) > 0);
    if (!inventoryEntries.length) {
      const item = document.createElement("div");
      item.className = "inventory-pill";
      item.innerHTML = "<span>库存</span><strong>空</strong>";
      els.inventoryGrid.appendChild(item);
      return;
    }
    inventoryEntries.forEach(([key, gift]) => {
      const count = state.inventory?.[key] || 0;
      const item = document.createElement("div");
      item.className = "inventory-pill";
      item.innerHTML = `<span>${gift.label}</span><strong>${count}</strong>`;
      els.inventoryGrid.appendChild(item);
    });
  }

  function recordScene(id) {
    if (!gameplay.scenes?.[id]) return;
    state.scenes = state.scenes || [];
    if (state.scenes.includes(id)) return false;
    state.scenes.push(id);
    return true;
  }

  function addUnlock(bucket, id, targetState = state) {
    if (!id) return false;
    targetState[bucket] = targetState[bucket] || [];
    if (targetState[bucket].includes(id)) return false;
    targetState[bucket].push(id);
    return true;
  }

  function archiveCollections(source = state) {
    return {
      scenes: [...(source.scenes || [])],
      memories: [...(source.memories || [])],
      endings: [...(source.endings || [])],
      epilogues: [...(source.epilogues || [])]
    };
  }

  function mergeUnique(left = [], right = []) {
    return [...new Set([...(left || []), ...(right || [])])];
  }

  function mergeCollections(left = {}, right = {}) {
    return {
      scenes: mergeUnique(left.scenes, right.scenes),
      memories: mergeUnique(left.memories, right.memories),
      endings: mergeUnique(left.endings, right.endings),
      epilogues: mergeUnique(left.epilogues, right.epilogues)
    };
  }

  function loadArchiveCollections() {
    try {
      const payload = JSON.parse(localStorage.getItem(archiveKey) || "{}");
      return mergeCollections(payload.collections || {}, {});
    } catch {
      return archiveCollections({});
    }
  }

  function writeArchiveCollections(collections) {
    localStorage.setItem(archiveKey, JSON.stringify({
      collections,
      updatedAt: new Date().toISOString()
    }));
  }

  function persistArchiveProgress(source = state) {
    const collections = mergeCollections(loadArchiveCollections(), archiveCollections(source));
    writeArchiveCollections(collections);
  }

  function archiveBucket(type) {
    const collections = mergeCollections(loadArchiveCollections(), archiveCollections(state));
    if (type === "ending") return collections.endings;
    if (type === "epilogue") return collections.epilogues;
    if (type === "memory") return collections.memories;
    if (type === "scene") return collections.scenes;
    return [];
  }

  function repairUnlocksFromProgress(targetState = state, nodeId = currentId) {
    let changed = false;
    Object.values(gameplay.actions || {}).forEach((action) => {
      if (!action.hero || !action.eventTargets?.length) return;
      const eventCount = targetState.events?.[action.hero] || 0;
      action.eventTargets.slice(0, eventCount).forEach((target) => {
        if (gameplay.scenes?.[target]) changed = addUnlock("scenes", target, targetState) || changed;
      });
    });

    Object.values(story.nodes || {}).forEach((node) => {
      (node.choices || []).forEach((choice) => {
        if (!gameplay.scenes?.[choice.target]) return;
        Object.keys(choice.effects?.flags || {}).forEach((flag) => {
          if (targetState.flags?.[flag]) {
            changed = addUnlock("scenes", choice.target, targetState) || changed;
          }
        });
      });
    });

    const node = story.nodes[nodeId];
    if (gameplay.scenes?.[nodeId]) changed = addUnlock("scenes", nodeId, targetState) || changed;
    if (node?.memory) changed = addUnlock("memories", node.memory, targetState) || changed;
    if (node?.ending) changed = addUnlock("endings", nodeId, targetState) || changed;
    if (node?.epilogue) changed = addUnlock("epilogues", nodeId, targetState) || changed;
    return changed;
  }

  function writeProgressPayload(id = replayOriginId || currentId, targetState = state, autoSaved = true) {
    const payload = {
      currentId: id,
      state: targetState,
      savedAt: new Date().toISOString()
    };
    if (autoSaved) payload.autoSaved = true;
    localStorage.setItem(story.saveKey, JSON.stringify(payload));
  }

  function persistProgress() {
    if (titleVisible) return;
    persistArchiveProgress();
  }

  function loadArchiveStateFromSave() {
    if (!titleVisible) {
      repairUnlocksFromProgress(state, currentId);
      persistArchiveProgress();
      return;
    }
    const payload = loadPayload();
    if (!payload?.state) return;
    currentId = payload.currentId;
    state = payload.state;
    repairUnlocksFromProgress(state, payload.currentId);
    persistArchiveProgress(state);
  }

  function render() {
    currentId = story.nodes[currentId] ? currentId : story.start;
    const node = story.nodes[currentId];

    const ids = nodeIds();
    els.route.textContent = node.route || "共通线";
    els.chapter.textContent = node.chapter || story.title;
    els.progress.textContent = `${Math.max(ids.indexOf(currentId) + 1, 1)} / ${ids.length}`;
    els.speaker.textContent = node.speaker || "旁白";
    els.mood.textContent = node.mood || "";
    els.text.textContent = node.text || "";
    els.choices.innerHTML = "";
    setAdvanceHint(node.hub ? "选择行动，行动点用完后结束今天" : "点击文字区域继续");
    let progressChanged = !!recordScene(currentId);

    setImage(
      els.bg,
      resolveAsset("backgrounds", node.background),
      node.mood || node.chapter
    );
    setImage(
      els.character,
      resolveAsset("characters", node.character),
      node.speaker || node.route
    );
    renderPortrait(node);

    renderStatus();
    if (node.memory) {
      state.memories = state.memories || [];
      if (!state.memories.includes(node.memory)) {
        state.memories.push(node.memory);
        progressChanged = true;
        renderStatus();
        setFeedback(`回忆解锁：${gameplay.memories[node.memory]}`);
      }
    }
    if (node.ending) {
      state.endings = state.endings || [];
      if (!state.endings.includes(currentId)) {
        state.endings.push(currentId);
        progressChanged = true;
        renderStatus();
        setFeedback(`结局解锁：${gameplay.endingDetails?.[currentId]?.title || node.chapter}`);
      }
    }
    if (node.epilogue) {
      state.epilogues = state.epilogues || [];
      if (!state.epilogues.includes(currentId)) {
        state.epilogues.push(currentId);
        progressChanged = true;
        renderStatus();
        setFeedback(`附录解锁：${gameplay.epilogueDetails?.[currentId]?.title || node.chapter}`);
      }
    }

    if (progressChanged) persistProgress();

    if (node.hub) {
      renderHub();
      return;
    }

    renderReplayReturnChoice();

    if (node.choices && node.choices.length) {
      stopAuto();
      node.choices.forEach((choice) => renderChoice(choice));
    }
  }

  function renderPortrait(node) {
    const portraitKey = inferPortrait(node);
    const src = resolveAsset("portraits", portraitKey);
    const meta = story.portraitStates?.[portraitKey];
    els.portraitFrame.classList.remove("is-ready");
    if (!src) {
      els.portrait.removeAttribute("src");
      els.expression.textContent = "";
      return;
    }
    els.portrait.onload = () => els.portraitFrame.classList.add("is-ready");
    els.portrait.onerror = () => els.portraitFrame.classList.remove("is-ready");
    els.portrait.src = src;
    els.portrait.alt = meta ? `${meta.character} ${meta.expression}` : "角色表情";
    els.expression.textContent = meta ? `${meta.character} · ${meta.outfit} · ${meta.expression}` : "";
  }

  function renderChoice(choice) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      if (choice.target === "restart") {
        restart();
        return;
      }
      applyEffects(choice.effects);
      go(choice.target);
    });
    els.choices.appendChild(button);
  }

  function renderReplayReturnChoice() {
    if (!replayOriginId) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "返回当前进度";
    button.addEventListener("click", returnFromReplay);
    els.choices.appendChild(button);
  }

  function renderEndDayChoice() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "is-primary";
    button.textContent = state.day >= gameplay.maxDay ? "进入毕业日结局判定" : `结束今天，进入第 ${state.day + 1} 天`;
    button.title = "行动点用完后，用这个按钮推进到下一天";
    button.addEventListener("click", advanceDay);
    els.choices.appendChild(button);
  }

  function renderHub() {
    renderReplayReturnChoice();

    if (state.ap <= 0) {
      renderEndDayChoice();
      return;
    }

    const header = document.createElement("button");
    header.type = "button";
    header.textContent = "进入毕业日结局判定";
    header.disabled = state.day < 14;
    header.classList.toggle("is-locked", state.day < 14);
    header.title = state.day < 14 ? "第 14 天后开放提前结局判定" : "根据当前好感、信任、属性和负罪感判定结局";
    header.addEventListener("click", resolveEnding);
    els.choices.appendChild(header);

    Object.entries(gameplay.actions).forEach(([id, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${action.label}（${action.costAP} AP）`;
      const locked = state.ap < action.costAP;
      button.disabled = locked;
      button.classList.toggle("is-locked", locked);
      button.addEventListener("click", () => performAction(id));
      els.choices.appendChild(button);
    });

    Object.entries(gameplay.dates || {}).forEach(([id, date]) => {
      const hero = gameplay.heroines[date.hero];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${date.label}（${date.costAP} AP）`;
      const locked =
        !isWeekend() ||
        state.ap < date.costAP ||
        (state.affection[date.hero] || 0) < date.minAffection ||
        (state.trust[date.hero] || 0) < date.minTrust ||
        !dateRequirementsMet(date);
      button.disabled = state.ap < date.costAP;
      button.classList.toggle("is-locked", locked);
      button.title = locked
        ? `${dateRequirementText(date)}周末开放，且需要${hero.name}好感 ${date.minAffection} / 信任 ${date.minTrust}`
        : "进入关键约会事件";
      button.addEventListener("click", () => performDate(id));
      els.choices.appendChild(button);
    });

    Object.entries(gameplay.gifts).forEach(([id, gift]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `购买：${gift.label}（${formatMoney(gift.cost)}）`;
      const available = giftAvailable(gift);
      const locked = state.money < gift.cost || !available;
      button.disabled = locked;
      button.classList.toggle("is-locked", locked);
      button.title = available
        ? "购买后进入库存，可从库存赠送"
        : giftUnlockText(gift);
      button.addEventListener("click", () => purchaseGift(id));
      els.choices.appendChild(button);
    });

    Object.entries(gameplay.gifts).forEach(([giftId, gift]) => {
      Object.entries(gameplay.heroines).forEach(([heroId, hero]) => {
        const count = state.inventory?.[giftId] || 0;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `送给${hero.name}：${gift.label}（库存 ${count} / 1 AP）`;
        const locked = count < 1 || state.ap < 1;
        button.disabled = locked;
        button.classList.toggle("is-locked", locked);
        button.addEventListener("click", () => performGift(giftId, heroId));
        els.choices.appendChild(button);
      });
    });

  }

  function actionFallbackTarget(action) {
    if (action.fallbackTargets?.length) {
      const hero = action.hero || "";
      const basis = state.day + (state.affection?.[hero] || 0) + (state.trust?.[hero] || 0);
      return action.fallbackTargets[basis % action.fallbackTargets.length];
    }
    return action.fallbackTarget;
  }

  function giftAvailable(gift) {
    if (!gift?.target) return true;
    if ((state.affection[gift.target] || 0) < (gift.minAffection || 0)) return false;
    if ((state.trust[gift.target] || 0) < (gift.minTrust || 0)) return false;
    if (gift.requiredFlag && !state.flags[gift.requiredFlag]) return false;
    return true;
  }

  function giftUnlockText(gift) {
    const hero = gameplay.heroines[gift.target];
    const name = hero ? hero.name : "对应角色";
    const parts = [];
    if (gift.minAffection) parts.push(`好感 ${gift.minAffection}`);
    if (gift.minTrust) parts.push(`信任 ${gift.minTrust}`);
    if (gift.requiredFlag) parts.push("前置事件");
    return `${name}需要${parts.join(" / ")}后，才适合购买这件礼物。`;
  }

  function dateRequiredFlags(date) {
    return [
      ...(date.requiredFlags || []),
      ...(date.requiredFlag ? [date.requiredFlag] : [])
    ];
  }

  function dateRequirementsMet(date) {
    return dateRequiredFlags(date).every((flag) => state.flags[flag]);
  }

  function dateRequirementText(date) {
    const count = dateRequiredFlags(date).filter((flag) => !state.flags[flag]).length;
    return count ? `需先完成 ${count} 个前置事件；` : "";
  }

  function renderArchive() {
    renderArchiveFilters();
    renderCollectionTips();
    renderReviewNotes();
    els.profileList.innerHTML = "";
    Object.entries(gameplay.heroines).forEach(([key, hero]) => {
      if (!matchesHero(key)) return;
      const item = document.createElement("article");
      item.className = "archive-card";
      const boundary = hero.boundaryNote
        ? `<br><span class="profile-note">${hero.boundaryNote}</span>`
        : "";
      item.innerHTML = `
        <span>${hero.route} · 核心属性：${gameplay.stats[hero.coreStat]}</span>
        <strong>${hero.name}</strong>
        <p>好感 ${state.affection[key] || 0} / 信任 ${state.trust[key] || 0}<br>${hero.preference}${boundary}</p>
      `;
      els.profileList.appendChild(item);
    });

    els.memoryList.innerHTML = "";
    Object.entries(gameplay.memories).forEach(([key, title]) => {
      const unlocked = archiveBucket("memory").includes(key);
      const detail = gameplay.memoryDetails?.[key];
      if (!matchesHero(detail?.hero)) return;
      const hero = detail ? gameplay.heroines[detail.hero] : null;
      const item = document.createElement("article");
      item.className = `archive-card${unlocked ? "" : " is-locked"}${unlocked && detail?.image ? " has-image" : ""}`;
      const image = unlocked && detail?.image
        ? `<img class="archive-thumb" src="${resolveAsset("backgrounds", detail.image)}" alt="${title}" />`
        : "";
      item.innerHTML = `
        ${image}
        <span>${hero ? hero.name : "未分类"} · ${unlocked ? "已解锁" : "未解锁"}</span>
        <strong>${unlocked ? title : "尚未留下的回忆"}</strong>
        <p>${unlocked && detail ? detail.text : "在高信任的周末约会中解锁。甜味很轻，但会留得很久。"}</p>
      `;
      els.memoryList.appendChild(item);
    });

    els.sceneList.innerHTML = "";
    Object.entries(gameplay.scenes || {}).forEach(([key, scene]) => {
      if (!matchesHero(scene.hero)) return;
      const unlocked = archiveBucket("scene").includes(key);
      const sceneImage = unlocked ? scene.image || story.nodes[key]?.background : "";
      const item = document.createElement("article");
      item.className = `archive-card${unlocked ? "" : " is-locked"}${sceneImage ? " has-image" : ""}`;
      const image = sceneImage
        ? `<img class="archive-thumb" src="${resolveAsset("backgrounds", sceneImage)}" alt="${scene.title}" />`
        : "";
      item.innerHTML = `
        ${image}
        <span>${scene.route} · ${unlocked ? "已解锁" : "未解锁"}</span>
        <strong>${unlocked ? scene.title : "尚未触发的事件"}</strong>
        <p>${unlocked ? sceneExcerpt(key) : "在日程行动、路线推进或高信任约会中触发。"}</p>
      `;
      if (unlocked) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "重读";
        button.addEventListener("click", () => {
          beginReplay(key);
        });
        item.appendChild(button);
      }
      els.sceneList.appendChild(item);
    });

    els.epilogueList.innerHTML = "";
    Object.entries(gameplay.epilogueDetails || {}).forEach(([key, epilogue]) => {
      if (!matchesHero(epilogue.hero)) return;
      const unlocked = archiveBucket("epilogue").includes(key);
      const hero = gameplay.heroines[epilogue.hero];
      const item = document.createElement("article");
      item.className = `archive-card${unlocked ? "" : " is-locked"}${unlocked && epilogue.image ? " has-image" : ""}`;
      const image = unlocked && epilogue.image
        ? `<img class="archive-thumb" src="${resolveAsset("backgrounds", epilogue.image)}" alt="${epilogue.title}" />`
        : "";
      item.innerHTML = `
        ${image}
        <span>${hero ? hero.name : "附录"} · ${unlocked ? "已解锁" : "未解锁"}</span>
        <strong>${unlocked ? epilogue.title : "尚未开启的后日谈"}</strong>
        <p>${unlocked ? epilogue.text : "抵达对应好结局后开放。这里保存的是结局之后仍然发亮的一小段甜味。"}</p>
      `;
      if (unlocked) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "重读";
        button.addEventListener("click", () => {
          beginReplay(key);
        });
        item.appendChild(button);
      }
      els.epilogueList.appendChild(item);
    });

    els.endingList.innerHTML = "";
    Object.entries(gameplay.endingDetails || {}).forEach(([key, ending]) => {
      if (!matchesHero(ending.hero)) return;
      const unlocked = archiveBucket("ending").includes(key);
      const hero = gameplay.heroines[ending.hero];
      const item = document.createElement("article");
      item.className = `archive-card${unlocked ? "" : " is-locked"}`;
      item.innerHTML = `
        <span>${hero ? hero.name : "结局"} · ${unlocked ? "已解锁" : "未解锁"}</span>
        <strong>${unlocked ? ending.title : "尚未抵达的结局"}</strong>
        <p>${unlocked ? ending.text : "根据好感、信任、路线事件、核心属性与负罪感判定。坏结局也会记录，因为它们是理解边界的一部分。"}</p>
      `;
      els.endingList.appendChild(item);
    });
  }

  function renderCollectionTips() {
    if (!els.collectionList) return;
    els.collectionList.innerHTML = "";
    Object.entries(gameplay.collectionTips || {}).forEach(([key, tip]) => {
      if (!matchesHero(tip.hero)) return;
      const requirements = tip.requirements || [];
      const completed = requirements.filter(requirementMet);
      const complete = requirements.length > 0 && completed.length === requirements.length;
      const item = document.createElement("article");
      item.className = `archive-card collection-card${complete ? "" : " is-locked"}${complete && tip.image ? " has-image" : ""}`;
      const image = complete && tip.image
        ? `<img class="archive-thumb" src="${resolveAsset("backgrounds", tip.image)}" alt="${tip.title}" />`
        : "";
      const progress = requirements.map((req) => {
        const mark = requirementMet(req) ? "已完成" : "未完成";
        return `${mark} ${requirementLabel(req)}`;
      }).join("<br>");
      const missing = requirements
        .filter((req) => !requirementMet(req))
        .map(requirementLabel)
        .slice(0, 2);
      const nextHint = missing.length
        ? `<br><span class="next-unlock">还差：${missing.join(" / ")}</span>`
        : "";
      item.innerHTML = `
        ${image}
        <span>${tip.category || "收集提示"} · ${completed.length}/${requirements.length}</span>
        <strong>${tip.title || key}</strong>
        <p>${complete ? tip.completeText : tip.hintText}</p>
        <p class="collection-progress">${progress}${nextHint}</p>
      `;
      if (complete && tip.replayTarget && canReplayTarget(tip.replayTarget)) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "重读关键片段";
        button.addEventListener("click", () => {
          beginReplay(tip.replayTarget);
        });
        item.appendChild(button);
      }
      els.collectionList.appendChild(item);
    });
  }

  function renderReviewNotes() {
    if (!els.reviewList) return;
    els.reviewList.innerHTML = "";
    Object.entries(gameplay.reviewNotes || {}).forEach(([key, note]) => {
      if (!matchesHero(note.hero)) return;
      const requirements = note.requirements || [];
      const completed = requirements.filter(requirementMet);
      const complete = requirements.length === 0 || completed.length === requirements.length;
      const item = document.createElement("article");
      item.className = `archive-card review-card${complete ? "" : " is-locked"}${complete && note.image ? " has-image" : ""}`;
      const image = complete && note.image
        ? `<img class="archive-thumb" src="${resolveAsset("backgrounds", note.image)}" alt="${note.title}" />`
        : "";
      const progress = requirements.map((req) => {
        const mark = requirementMet(req) ? "已完成" : "未完成";
        return `${mark} ${requirementLabel(req)}`;
      }).join("<br>");
      const missing = requirements
        .filter((req) => !requirementMet(req))
        .map(requirementLabel)
        .slice(0, 2);
      const nextHint = missing.length
        ? `<br><span class="next-unlock">还差：${missing.join(" / ")}</span>`
        : "";
      item.innerHTML = `
        ${image}
        <span>${note.category || "回看札记"} · ${completed.length}/${requirements.length}</span>
        <strong>${note.title || key}</strong>
        <p>${complete ? note.completeText : note.hintText}</p>
        <p class="collection-progress">${progress}${nextHint}</p>
      `;
      if (complete && note.replayTarget && canReplayTarget(note.replayTarget)) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "重读札记片段";
        button.addEventListener("click", () => {
          beginReplay(note.replayTarget);
        });
        item.appendChild(button);
      }
      els.reviewList.appendChild(item);
    });
  }

  function renderArchiveFilters() {
    els.archiveFilters.innerHTML = "";
    const filters = [
      ["all", "全部"],
      ["haruka", gameplay.heroines.haruka.name],
      ["aoi", gameplay.heroines.aoi.name],
      ["fuyuko", gameplay.heroines.fuyuko.name]
    ];
    filters.forEach(([key, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.classList.toggle("is-active", archiveFilter === key);
      button.addEventListener("click", () => {
        archiveFilter = key;
        renderArchive();
      });
      els.archiveFilters.appendChild(button);
    });
  }

  function matchesHero(hero) {
    if (archiveFilter === "all") return true;
    return hero === archiveFilter;
  }

  function sceneExcerpt(id) {
    const node = story.nodes[id];
    if (!node?.text) return "这段回忆还没有整理成文字。";
    return node.text.replace(/\s+/g, " ").slice(0, 82) + "…";
  }

  function requirementMet(req) {
    return requirementBucket(req.type).includes(req.id);
  }

  function requirementBucket(type) {
    return archiveBucket(type);
  }

  function requirementLabel(req) {
    if (req.type === "ending") return `结局：${gameplay.endingDetails?.[req.id]?.title || req.id}`;
    if (req.type === "epilogue") return `后日谈：${gameplay.epilogueDetails?.[req.id]?.title || req.id}`;
    if (req.type === "memory") return `甜美回忆：${gameplay.memories?.[req.id] || req.id}`;
    if (req.type === "scene") return `${sceneRequirementKind(req.id)}：${gameplay.scenes?.[req.id]?.title || req.id}`;
    return req.id;
  }

  function sceneRequirementKind(id) {
    const route = gameplay.scenes?.[id]?.route || "";
    if (route.includes("分歧")) return "分歧事件";
    if (route.includes("结局")) return "结局前回收";
    if (route.includes("约会")) return "约会事件";
    if (route.includes("礼物")) return "礼物事件";
    return "路线事件";
  }

  function canReplayTarget(target) {
    if (!story.nodes[target]) return false;
    if (gameplay.endingDetails?.[target]) return archiveBucket("ending").includes(target);
    if (gameplay.epilogueDetails?.[target]) return archiveBucket("epilogue").includes(target);
    if (gameplay.scenes?.[target]) return archiveBucket("scene").includes(target);
    return false;
  }

  function renderTitle() {
    setImage(els.titleBg, resolveAsset("backgrounds", "titleCover"), story.title);
    els.title.classList.toggle("is-hidden", !titleVisible);
    els.titleContinue.disabled = !localStorage.getItem(story.saveKey);
    els.titleStatus.textContent = localStorage.getItem(story.saveKey)
      ? "可以继续上次进度"
      : "点击 Start 开始";
  }

  function hideTitle() {
    titleVisible = false;
    renderTitle();
  }

  function startNewGame() {
    stopAuto();
    replayOriginId = null;
    replayOriginState = null;
    replayOriginTitleVisible = false;
    currentId = story.start;
    state = clone(gameplay.initialState);
    feedbackText = "尚未保存";
    hideTitle();
    render();
  }

  function continueFromTitle() {
    const payload = loadPayload();
    if (!payload) {
      els.titleStatus.textContent = "没有存档";
      return;
    }
    replayOriginId = null;
    replayOriginState = null;
    replayOriginTitleVisible = false;
    currentId = payload.currentId;
    state = payload.state || clone(gameplay.initialState);
    repairUnlocksFromProgress(state, currentId);
    persistArchiveProgress(state);
    hideTitle();
    render();
    setFeedback("已读取");
  }

  function openArchive() {
    loadArchiveStateFromSave();
    renderArchive();
    if (typeof els.archiveDialog.showModal === "function") {
      els.archiveDialog.showModal();
    } else {
      els.archiveDialog.setAttribute("open", "");
    }
  }

  function closeArchive() {
    if (typeof els.archiveDialog.close === "function") {
      els.archiveDialog.close();
    } else {
      els.archiveDialog.removeAttribute("open");
    }
  }

  function isWeekend() {
    const dayOfWeek = ((state.day - 1) % 7) + 1;
    return dayOfWeek === 6 || dayOfWeek === 7;
  }

  function weekdayLabel() {
    const names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
    return names[(state.day - 1) % 7];
  }

  function performAction(id) {
    const action = gameplay.actions[id];
    if (!action || state.ap < action.costAP) return;
    state.ap -= action.costAP;
    state.money += action.money || 0;
    applyEffects(action.effects);
    setFeedback(pickFeedback("actions", id) || (action.hero
      ? `${gameplay.heroines[action.hero].name}注意到了你的靠近。`
      : `完成行动：${action.label}`));

    let target = action.fallbackTargets?.length ? actionFallbackTarget(action) : action.target;
    if (action.hero) {
      const eventIndex = state.events[action.hero] || 0;
      const nextEvent = action.eventTargets[eventIndex];
      target = nextEvent || actionFallbackTarget(action);
      if (nextEvent) state.events[action.hero] = eventIndex + 1;
    }
    go(target);
  }

  function purchaseGift(id) {
    const gift = gameplay.gifts[id];
    if (!gift || state.money < gift.cost) return;
    if (!giftAvailable(gift)) {
      setFeedback(giftUnlockText(gift));
      return;
    }
    state.money -= gift.cost;
    state.inventory = state.inventory || {};
    state.inventory[id] = (state.inventory[id] || 0) + 1;
    render();
    setFeedback(pickFeedback("purchase", "", { gift: gift.label }) || `已购买：${gift.label}`);
  }

  function performGift(id, heroId) {
    const gift = gameplay.gifts[id];
    if (!gift || (state.inventory?.[id] || 0) < 1 || state.ap < 1) return;
    state.inventory[id] -= 1;
    state.ap -= 1;
    if (heroId === gift.target) {
      applyEffects(gift.effects);
      const hero = gameplay.heroines[heroId];
      setFeedback(pickFeedback("giftGood", "", { name: hero.name, gift: gift.label }) || `${hero.name}收下了${gift.label}，表情比刚才柔软了一点。`);
      go(gift.result);
      return;
    }

    const effects = {
      affection: { [heroId]: gameplay.wrongGiftEffects.affection },
      trust: { [heroId]: gameplay.wrongGiftEffects.trust },
      stats: { guilt: gameplay.wrongGiftEffects.guilt }
    };
    applyEffects(effects);
    state.flags[heroFlag("wrongGift", heroId)] = true;
    setFeedback(pickFeedback("giftWrong") || "礼物不太合适。对方很礼貌，但信任轻轻后退了一步。");
    const wrongGiftTarget = `gift_wrong_${heroId}`;
    go(story.nodes[wrongGiftTarget] ? wrongGiftTarget : "gift_wrong");
  }

  function performDate(id) {
    const date = gameplay.dates[id];
    if (!date || state.ap < date.costAP) return;
    if (!isWeekend()) {
      setFeedback(pickFeedback("dateLocked") || "现在还不是合适的周末。");
      return;
    }
    if ((state.affection[date.hero] || 0) < date.minAffection) {
      setFeedback(pickFeedback("dateLocked") || "好感还不足以抵达这个约会。");
      return;
    }
    if ((state.trust[date.hero] || 0) < date.minTrust) {
      setFeedback(pickFeedback("dateLocked") || "信任还不够深。");
      return;
    }
    if (!dateRequirementsMet(date)) {
      setFeedback(pickFeedback("dateLocked") || "需要先完成前置约会。");
      return;
    }
    state.ap -= date.costAP;
    applyEffects(date.effects);
    const hero = gameplay.heroines[date.hero];
    setFeedback(pickFeedback("dateGood", "", { name: hero.name }) || `${hero.name}的信任更深了。这样的周末会被记很久。`);
    go(date.target);
  }

  function beginReplay(id) {
    if (!story.nodes[id]) return;
    replayOriginId = currentId;
    replayOriginState = clone(state);
    replayOriginTitleVisible = titleVisible;
    closeArchive();
    hideTitle();
    go(id);
    setFeedback("正在重读事件，结束时会回到当前进度。");
  }

  function returnFromReplay() {
    if (!replayOriginId) return;
    const origin = replayOriginId;
    const originState = replayOriginState ? clone(replayOriginState) : state;
    const shouldShowTitle = replayOriginTitleVisible;
    replayOriginId = null;
    replayOriginState = null;
    replayOriginTitleVisible = false;
    currentId = origin;
    state = originState;
    titleVisible = shouldShowTitle;
    renderTitle();
    render();
    setFeedback("已返回当前进度");
  }

  function advanceDay() {
    state.day += 1;
    state.ap = gameplay.maxAP;
    if (state.day > gameplay.maxDay) {
      resolveEnding();
    } else {
      setFeedback(pickFeedback("endDay") || "一天结束了。");
      go("daily_hub");
    }
  }

  function strongestHero() {
    return Object.keys(gameplay.heroines)
      .map((key) => ({
        key,
        score:
          (state.affection[key] || 0) * 2 +
          (state.trust[key] || 0) * 3 +
          (state.events[key] || 0) * 4
      }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function resolveEnding() {
    const top = strongestHero();
    const hero = top.key;
    const affection = state.affection[hero] || 0;
    const trust = state.trust[hero] || 0;
    const events = state.events[hero] || 0;
    const coreStat = gameplay.heroines[hero].coreStat;
    const stat = state.stats[coreStat] || 0;
    const guilt = state.stats.guilt || 0;

    let ending = "ending_normal";
    if (top.score >= 38 && affection >= 10 && trust >= 7 && events >= 5 && stat >= 6 && guilt <= 7) {
      ending = `ending_${hero}_good`;
    } else if (affection >= 6 && (trust < 5 || events < 4 || guilt >= 8)) {
      ending = `ending_${hero}_bad`;
    }
    go(endingPreludeTarget(ending, hero));
  }

  function routeMemoryCount(hero) {
    return (state.memories || []).filter((memory) => gameplay.memoryDetails?.[memory]?.hero === hero).length;
  }

  function endingPreludeTarget(ending, hero) {
    const type = ending.includes("_bad")
      ? "bad"
      : ending === "ending_normal"
        ? "normal"
        : "repair";
    const foreshadowFlag = heroFlag("badForeshadow", hero);
    if (state.flags?.[foreshadowFlag]) {
      const prelude = `prelude_${hero}_${type}`;
      return story.nodes[prelude] ? prelude : ending;
    }

    const wrongGiftFlag = heroFlag("wrongGift", hero);
    if (state.flags?.[wrongGiftFlag]) {
      const prelude = `prelude_${hero}_wrong_gift_${type}`;
      return story.nodes[prelude] ? prelude : ending;
    }

    const affection = state.affection?.[hero] || 0;
    const events = state.events?.[hero] || 0;
    const missedEvent = type === "bad" ? events < 4 : type === "normal" ? events < 5 : false;
    const eventAffectionReached = type === "bad" ? affection >= 6 : affection >= 10;
    if (eventAffectionReached && missedEvent) {
      const prelude = `prelude_${hero}_missed_event_${type}`;
      return story.nodes[prelude] ? prelude : ending;
    }

    const trust = state.trust?.[hero] || 0;
    const lowTrust = type === "bad" ? trust < 5 : type === "normal" ? trust < 7 : false;
    if (affection >= 10 && lowTrust) {
      const prelude = `prelude_${hero}_low_trust_${type}`;
      return story.nodes[prelude] ? prelude : ending;
    }

    const routeMemories = routeMemoryCount(hero);
    const missedDate =
      type === "repair" ? routeMemories < 2 : type === "normal" ? routeMemories === 0 : false;
    const dateAffectionReached = type === "repair" ? affection >= 10 : affection >= 8;
    if (dateAffectionReached && events >= 5 && missedDate) {
      const prelude = `prelude_${hero}_missed_date_${type}`;
      return story.nodes[prelude] ? prelude : ending;
    }

    if (type === "normal") {
      const prelude = `prelude_${hero}_normal_aftertaste`;
      return story.nodes[prelude] ? prelude : ending;
    }

    return ending;
  }

  function go(id) {
    if (!id || !story.nodes[id]) return;
    currentId = id;
    render();
    if (auto) scheduleAuto();
  }

  function next() {
    const node = story.nodes[currentId];
    if (!node || node.choices || node.hub || node.ending) return;
    if (replayOriginId && node.next === "daily_hub") {
      returnFromReplay();
      return;
    }
    if (node.next) go(node.next);
  }

  function scheduleAuto() {
    clearTimeout(timer);
    timer = setTimeout(next, 3200);
  }

  function stopAuto() {
    auto = false;
    clearTimeout(timer);
    els.auto.classList.remove("is-active");
  }

  function toggleAuto() {
    auto = !auto;
    els.auto.classList.toggle("is-active", auto);
    if (auto) scheduleAuto();
  }

  function save() {
    repairUnlocksFromProgress();
    persistArchiveProgress();
    writeProgressPayload(replayOriginId || currentId, replayOriginState || state, false);
    setFeedback("已保存");
  }

  function load() {
    const payload = loadPayload();
    if (!payload) {
      setFeedback("存档损坏");
      return;
    }
    currentId = payload.currentId;
    state = payload.state || clone(gameplay.initialState);
    repairUnlocksFromProgress(state, currentId);
    persistArchiveProgress(state);
    replayOriginId = null;
    replayOriginState = null;
    replayOriginTitleVisible = false;
    hideTitle();
    render();
    setFeedback("已读取");
  }

  function loadPayload() {
    try {
      const payload = JSON.parse(localStorage.getItem(story.saveKey) || "{}");
      if (payload.currentId && story.nodes[payload.currentId]) return payload;
      return null;
    } catch {
      return null;
    }
  }

  function restart() {
    stopAuto();
    replayOriginId = null;
    replayOriginState = null;
    replayOriginTitleVisible = false;
    currentId = story.start;
    state = clone(gameplay.initialState);
    titleVisible = false;
    render();
    setFeedback("已重新开始");
  }

  els.panel.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    next();
  });
  els.auto.addEventListener("click", toggleAuto);
  els.save.addEventListener("click", save);
  els.load.addEventListener("click", load);
  els.archive.addEventListener("click", openArchive);
  els.archiveClose.addEventListener("click", closeArchive);
  els.restart.addEventListener("click", restart);
  els.titleStart.addEventListener("click", startNewGame);
  els.titleContinue.addEventListener("click", continueFromTitle);
  els.titleArchive.addEventListener("click", openArchive);

  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      next();
    }
    if (event.key.toLowerCase() === "s") save();
    if (event.key.toLowerCase() === "l") load();
  });

  render();
  renderTitle();
})();

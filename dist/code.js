"use strict";
(() => {
  // src/main/iconDetector.ts
  function isIconCandidate(node, config) {
    if (!node.visible) return false;
    if (config.onlyComponents) {
      if (node.type !== "COMPONENT" && node.type !== "INSTANCE") {
        return false;
      }
    }
    const allowedContainers = ["COMPONENT", "INSTANCE", "FRAME", "GROUP", "BOOLEAN_OPERATION"];
    if (!allowedContainers.includes(node.type)) {
      return false;
    }
    const w = node.width;
    const h = node.height;
    if (w < config.minDimension || h < config.minDimension) return false;
    if (w > config.maxDimension || h > config.maxDimension) return false;
    const ratio = w / h;
    if (ratio < 0.75 || ratio > 1.33) return false;
    if ("children" in node) {
      const children = node.children;
      if (children.length === 0 && node.type !== "BOOLEAN_OPERATION") return false;
      if (hasTextLayer(node)) return false;
      if (!hasAnyVectorLayer(node)) return false;
    }
    return true;
  }
  function hasTextLayer(container) {
    for (const child of container.children) {
      if (child.type === "TEXT") return true;
      if ("children" in child) {
        if (hasTextLayer(child)) return true;
      }
    }
    return false;
  }
  function hasAnyVectorLayer(container) {
    const vectorTypes = ["VECTOR", "BOOLEAN_OPERATION", "ELLIPSE", "LINE", "POLYGON", "STAR", "RECTANGLE"];
    for (const child of container.children) {
      if (vectorTypes.includes(child.type)) return true;
      if ("children" in child) {
        if (hasAnyVectorLayer(child)) return true;
      }
    }
    return false;
  }
  function buildHierarchyPath(node) {
    const parts = [];
    let curr = node.parent;
    while (curr && curr.type !== "PAGE" && curr.type !== "DOCUMENT") {
      parts.unshift(curr.name.trim());
      curr = curr.parent;
    }
    return parts.join(" / ");
  }
  function getTopLevelScreenName(node) {
    let curr = node;
    let topScreen = node.name;
    while (curr && curr.parent && curr.parent.type !== "PAGE" && curr.parent.type !== "DOCUMENT") {
      curr = curr.parent;
      if ("name" in curr) {
        topScreen = curr.name;
      }
    }
    return topScreen;
  }
  function scanForIcons(rootNodes, pageName, config) {
    const icons = [];
    const visited = /* @__PURE__ */ new Set();
    function traverse(node) {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      if (isIconCandidate(node, config)) {
        icons.push({
          id: node.id,
          name: node.name,
          width: Math.round(node.width),
          height: Math.round(node.height),
          pageName,
          screenName: getTopLevelScreenName(node),
          parentPath: buildHierarchyPath(node),
          slashPath: node.name.includes("/") ? node.name : "",
          type: node.type
        });
        return;
      }
      if ("children" in node && node.type !== "BOOLEAN_OPERATION") {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    for (const root of rootNodes) {
      traverse(root);
    }
    return icons;
  }

  // src/main/colorExtractor.ts
  function figmaColorToHex(color, opacity = 1) {
    const r = Math.min(255, Math.max(0, Math.round(color.r * 255)));
    const g = Math.min(255, Math.max(0, Math.round(color.g * 255)));
    const b = Math.min(255, Math.max(0, Math.round(color.b * 255)));
    const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
    if (opacity < 0.999) {
      const a = Math.min(255, Math.max(0, Math.round(opacity * 255)));
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function extractProjectColors(rootNodes) {
    const colorMap = /* @__PURE__ */ new Map();
    try {
      const localStyles = figma.getLocalPaintStyles();
      for (const style of localStyles) {
        for (const paint of style.paints) {
          if (paint.type === "SOLID" && paint.visible !== false) {
            const alpha = paint.opacity ?? 1;
            const hex = figmaColorToHex(paint.color, alpha);
            colorMap.set(hex, {
              hex,
              rgb: {
                r: Math.round(paint.color.r * 255),
                g: Math.round(paint.color.g * 255),
                b: Math.round(paint.color.b * 255),
                a: Number(alpha.toFixed(2))
              },
              name: style.name,
              usageCount: 0,
              source: "style"
            });
          }
        }
      }
    } catch (err) {
      console.warn("Could not read local paint styles:", err);
    }
    try {
      if (figma.variables && typeof figma.variables.getLocalVariables === "function") {
        const colorVariables = figma.variables.getLocalVariables("COLOR");
        for (const variable of colorVariables) {
          const defaultModeId = Object.keys(variable.valuesByMode)[0];
          const val = variable.valuesByMode[defaultModeId];
          if (val && typeof val === "object" && "r" in val) {
            const colorVal = val;
            const alpha = colorVal.a ?? 1;
            const hex = figmaColorToHex(colorVal, alpha);
            if (!colorMap.has(hex)) {
              colorMap.set(hex, {
                hex,
                rgb: {
                  r: Math.round(colorVal.r * 255),
                  g: Math.round(colorVal.g * 255),
                  b: Math.round(colorVal.b * 255),
                  a: Number(alpha.toFixed(2))
                },
                name: variable.name,
                usageCount: 0,
                source: "variable"
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("Could not read local variables:", err);
    }
    function inspectPaints(paints) {
      if (!Array.isArray(paints)) return;
      for (const paint of paints) {
        if (paint.type === "SOLID" && paint.visible !== false) {
          const alpha = paint.opacity ?? 1;
          const hex = figmaColorToHex(paint.color, alpha);
          const existing = colorMap.get(hex);
          if (existing) {
            existing.usageCount++;
          } else {
            colorMap.set(hex, {
              hex,
              rgb: {
                r: Math.round(paint.color.r * 255),
                g: Math.round(paint.color.g * 255),
                b: Math.round(paint.color.b * 255),
                a: Number(alpha.toFixed(2))
              },
              usageCount: 1,
              source: "raw_node"
            });
          }
        }
      }
    }
    function walk(node) {
      if (!node.visible) return;
      if ("fills" in node) {
        inspectPaints(node.fills);
      }
      if ("strokes" in node) {
        inspectPaints(node.strokes);
      }
      if ("children" in node) {
        for (const child of node.children) {
          walk(child);
        }
      }
    }
    for (const root of rootNodes) {
      walk(root);
    }
    return Array.from(colorMap.values()).sort((a, b) => {
      if (a.source === "style" && b.source !== "style") return -1;
      if (b.source === "style" && a.source !== "style") return 1;
      return b.usageCount - a.usageCount;
    });
  }

  // src/main/typographyExtractor.ts
  function parseFontWeight(style) {
    const s = style.toLowerCase();
    if (s.includes("thin") || s.includes("hairline")) return 100;
    if (s.includes("extralight") || s.includes("ultra light") || s.includes("extra light")) return 200;
    if (s.includes("light")) return 300;
    if (s.includes("medium")) return 500;
    if (s.includes("semibold") || s.includes("semi bold") || s.includes("demibold")) return 600;
    if (s.includes("extrabold") || s.includes("ultra bold") || s.includes("extra bold")) return 800;
    if (s.includes("black") || s.includes("heavy")) return 900;
    if (s.includes("bold")) return 700;
    return 400;
  }
  function formatLineHeight(lh) {
    if (!lh || lh === figma.mixed) return "normal";
    if (lh.unit === "AUTO") return "normal";
    if (lh.unit === "PERCENT") return `${Math.round(lh.value)}%`;
    return `${Math.round(lh.value)}px`;
  }
  function formatLetterSpacing(ls) {
    if (!ls || ls === figma.mixed) return "normal";
    if (ls.unit === "PERCENT") return `${Math.round(ls.value)}%`;
    return `${Number(ls.value.toFixed(2))}px`;
  }
  function extractProjectTypography(rootNodes) {
    const typoMap = /* @__PURE__ */ new Map();
    try {
      const textStyles = figma.getLocalTextStyles();
      for (const style of textStyles) {
        if (style.fontName && typeof style.fontName === "object" && "family" in style.fontName) {
          const fontName = style.fontName;
          const fontSize = Math.round(style.fontSize);
          const key = `${fontName.family}-${fontName.style}-${fontSize}`;
          typoMap.set(key, {
            id: style.id,
            name: style.name,
            fontFamily: fontName.family,
            fontStyle: fontName.style,
            fontWeight: parseFontWeight(fontName.style),
            fontSize,
            lineHeight: formatLineHeight(style.lineHeight),
            letterSpacing: formatLetterSpacing(style.letterSpacing),
            usageCount: 0,
            source: "style"
          });
        }
      }
    } catch (err) {
      console.warn("Could not read local text styles:", err);
    }
    function walk(node) {
      if (!node.visible) return;
      if (node.type === "TEXT") {
        const textNode = node;
        let fontName = null;
        let fontSize = 16;
        if (textNode.fontName !== figma.mixed) {
          fontName = textNode.fontName;
        } else if (textNode.characters.length > 0) {
          try {
            const fn = textNode.getRangeFontName(0, 1);
            if (fn !== figma.mixed) fontName = fn;
          } catch {
          }
        }
        if (textNode.fontSize !== figma.mixed) {
          fontSize = Math.round(textNode.fontSize);
        } else if (textNode.characters.length > 0) {
          try {
            const fs = textNode.getRangeFontSize(0, 1);
            if (typeof fs === "number") fontSize = Math.round(fs);
          } catch {
          }
        }
        if (fontName && typeof fontName === "object" && fontName.family) {
          const key = `${fontName.family}-${fontName.style}-${fontSize}`;
          const existing = typoMap.get(key);
          if (existing) {
            existing.usageCount++;
          } else {
            typoMap.set(key, {
              id: textNode.id,
              fontFamily: fontName.family,
              fontStyle: fontName.style,
              fontWeight: parseFontWeight(fontName.style),
              fontSize,
              lineHeight: formatLineHeight(textNode.lineHeight),
              letterSpacing: formatLetterSpacing(textNode.letterSpacing),
              usageCount: 1,
              source: "raw_node"
            });
          }
        }
      }
      if ("children" in node) {
        for (const child of node.children) {
          walk(child);
        }
      }
    }
    for (const root of rootNodes) {
      walk(root);
    }
    return Array.from(typoMap.values()).sort((a, b) => {
      if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
      return b.usageCount - a.usageCount;
    });
  }

  // src/main/componentAuditor.ts
  function figmaColorToHex2(color, opacity = 1) {
    const r = Math.min(255, Math.max(0, Math.round(color.r * 255)));
    const g = Math.min(255, Math.max(0, Math.round(color.g * 255)));
    const b = Math.min(255, Math.max(0, Math.round(color.b * 255)));
    const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
    if (opacity < 0.999) {
      const a = Math.min(255, Math.max(0, Math.round(opacity * 255)));
      return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
    }
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function parseFontWeight2(style) {
    const s = style.toLowerCase();
    if (s.includes("thin") || s.includes("hairline")) return 100;
    if (s.includes("extralight") || s.includes("ultra light") || s.includes("extra light")) return 200;
    if (s.includes("light")) return 300;
    if (s.includes("medium")) return 500;
    if (s.includes("semibold") || s.includes("semi bold") || s.includes("demibold")) return 600;
    if (s.includes("extrabold") || s.includes("ultra bold") || s.includes("extra bold")) return 800;
    if (s.includes("black") || s.includes("heavy")) return 900;
    if (s.includes("bold")) return 700;
    return 400;
  }
  function getTopLevelScreenName2(node) {
    let curr = node;
    let topScreen = node.name;
    while (curr && curr.parent && curr.parent.type !== "PAGE" && curr.parent.type !== "DOCUMENT") {
      curr = curr.parent;
      if ("name" in curr) {
        topScreen = curr.name;
      }
    }
    return topScreen;
  }
  function extractNodeProperties(node) {
    const width = Math.round(node.width);
    const height = Math.round(node.height);
    let cornerRadius = 0;
    if ("cornerRadius" in node && node.cornerRadius !== figma.mixed) {
      cornerRadius = Math.round(node.cornerRadius);
    } else if ("topLeftRadius" in node) {
      const tl = Math.round(node.topLeftRadius);
      const tr = Math.round(node.topRightRadius);
      const br = Math.round(node.bottomRightRadius);
      const bl = Math.round(node.bottomLeftRadius);
      if (tl === tr && tr === br && br === bl) {
        cornerRadius = tl;
      } else {
        cornerRadius = `${tl}, ${tr}, ${br}, ${bl}`;
      }
    }
    const fills = [];
    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === "SOLID" && fill.visible !== false) {
          fills.push(figmaColorToHex2(fill.color, fill.opacity ?? 1));
        }
      }
    }
    const strokes = [];
    if (Array.isArray(node.strokes)) {
      const weight = typeof node.strokeWeight === "number" ? Math.round(node.strokeWeight) : 1;
      for (const stroke of node.strokes) {
        if (stroke.type === "SOLID" && stroke.visible !== false) {
          strokes.push({
            color: figmaColorToHex2(stroke.color, stroke.opacity ?? 1),
            weight
          });
        }
      }
    }
    const padding = {
      top: typeof node.paddingTop === "number" ? Math.round(node.paddingTop) : 0,
      right: typeof node.paddingRight === "number" ? Math.round(node.paddingRight) : 0,
      bottom: typeof node.paddingBottom === "number" ? Math.round(node.paddingBottom) : 0,
      left: typeof node.paddingLeft === "number" ? Math.round(node.paddingLeft) : 0
    };
    const gap = typeof node.itemSpacing === "number" ? Math.round(node.itemSpacing) : 0;
    const layoutMode = node.layoutMode || "NONE";
    let typography = void 0;
    for (const child of node.children) {
      if (child.type === "TEXT") {
        const textNode = child;
        const fn = textNode.fontName !== figma.mixed ? textNode.fontName : null;
        const fs = textNode.fontSize !== figma.mixed ? Math.round(textNode.fontSize) : 14;
        if (fn && fn.family) {
          typography = {
            family: fn.family,
            size: fs,
            weight: parseFontWeight2(fn.style),
            text: textNode.characters.slice(0, 30)
          };
          break;
        }
      }
    }
    return {
      width,
      height,
      cornerRadius,
      fills,
      strokes,
      padding,
      gap,
      layoutMode,
      typography
    };
  }
  function detectCategory(node, props) {
    const name = node.name.toLowerCase();
    const w = props.width;
    const h = props.height;
    const ratio = w / Math.max(1, h);
    if (Math.abs(w - h) <= 2 && w >= 20 && w <= 96 && (typeof props.cornerRadius === "number" && props.cornerRadius >= w / 2 - 2)) {
      return "avatar";
    }
    if (name.includes("avatar") || name.includes("profile-pic") || name.includes("user-img")) {
      return "avatar";
    }
    if (name.includes("btn") || name.includes("button") || name.includes("cta") || name.includes("submit") || name.includes("action") || name.includes("login") || name.includes("signup")) {
      return "button";
    }
    if (h >= 24 && h <= 64 && w >= 48 && w <= 360 && ratio >= 1.5 && ratio <= 7 && props.typography) {
      return "button";
    }
    if (name.includes("input") || name.includes("field") || name.includes("search") || name.includes("textbox") || name.includes("form")) {
      return "input";
    }
    if (h >= 32 && h <= 58 && w >= 140 && w <= 460 && ratio >= 2.5) {
      return "input";
    }
    if (name.includes("badge") || name.includes("chip") || name.includes("tag") || name.includes("pill") || name.includes("status")) {
      return "badge";
    }
    if (h >= 16 && h <= 32 && w >= 28 && w <= 160 && (typeof props.cornerRadius === "number" && props.cornerRadius >= 8)) {
      return "badge";
    }
    if (name.includes("card") || name.includes("tile") || name.includes("panel") || name.includes("box") || name.includes("item-card")) {
      return "card";
    }
    if (w >= 140 && h >= 90) {
      return "card";
    }
    if (h >= 32 && h <= 88 && w >= 200 && ratio >= 3.5) {
      return "row_item";
    }
    return "other";
  }
  function cleanClusterName(name) {
    return name.replace(/[/\\_-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function auditProjectComponents(rootNodes) {
    const candidateInstances = [];
    const visited = /* @__PURE__ */ new Set();
    function traverse(node, pageName) {
      if (!node.visible || visited.has(node.id)) return;
      visited.add(node.id);
      const isFrameLike = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
      if (isFrameLike) {
        const frame = node;
        const w = frame.width;
        const h = frame.height;
        const isGiantScreen = w >= 800 && h >= 600;
        const isPureTinyIcon = w <= 44 && h <= 44;
        if (!isGiantScreen && !isPureTinyIcon && (frame.children && frame.children.length > 0)) {
          const props = extractNodeProperties(frame);
          const category = detectCategory(frame, props);
          candidateInstances.push({
            item: {
              nodeId: frame.id,
              name: frame.name,
              pageName,
              screenName: getTopLevelScreenName2(frame),
              properties: props
            },
            category,
            node: frame
          });
        }
      }
      if ("children" in node && node.type !== "BOOLEAN_OPERATION") {
        for (const child of node.children) {
          traverse(child, pageName);
        }
      }
    }
    for (const root of rootNodes) {
      let pageName = "Page 1";
      let curr = root;
      while (curr) {
        if (curr.type === "PAGE") {
          pageName = curr.name;
          break;
        }
        curr = curr.parent;
      }
      traverse(root, pageName);
    }
    const clusterBuckets = /* @__PURE__ */ new Map();
    for (const { item, category, node } of candidateInstances) {
      const w = item.properties.width;
      const h = item.properties.height;
      const wBucket = Math.round(w / 16) * 16;
      const hBucket = Math.round(h / 8) * 8;
      const normName = cleanClusterName(item.name.toLowerCase().split("/")[0]);
      const clusterKey = `${category}_${normName}_${wBucket}x${hBucket}`;
      if (!clusterBuckets.has(clusterKey)) {
        clusterBuckets.set(clusterKey, {
          category,
          representativeName: cleanClusterName(item.name),
          representativeNodeId: node.id,
          instances: []
        });
      }
      clusterBuckets.get(clusterKey).instances.push(item);
    }
    const clusters = [];
    for (const [clusterId, bucket] of clusterBuckets.entries()) {
      if (bucket.instances.length < 2) continue;
      const instances = bucket.instances;
      const totalOccurrences = instances.length;
      const firstProps = instances[0].properties;
      const sharedDimensions = { width: firstProps.width, height: firstProps.height };
      const sharedRadius = firstProps.cornerRadius;
      const sharedFills = firstProps.fills;
      const distinctRadiuses = new Set(instances.map((i) => i.properties.cornerRadius));
      const distinctFills = new Set(instances.map((i) => i.properties.fills.join(",")));
      const distinctDims = new Set(instances.map((i) => `${i.properties.width}x${i.properties.height}`));
      const details = [];
      const hasRadiusMismatch = distinctRadiuses.size > 1;
      const hasColorMismatch = distinctFills.size > 1;
      const hasDimensionMismatch = distinctDims.size > 1;
      if (hasRadiusMismatch) {
        details.push(`Corner radius mismatch: found ${Array.from(distinctRadiuses).join(", ")}`);
      }
      if (hasColorMismatch) {
        details.push(`Background color mismatch across instances`);
      }
      if (hasDimensionMismatch) {
        details.push(`Dimensions slightly vary: ${Array.from(distinctDims).slice(0, 3).join(", ")}`);
      }
      clusters.push({
        clusterId,
        category: bucket.category,
        representativeName: bucket.representativeName,
        totalOccurrences,
        representativeNodeId: bucket.representativeNodeId,
        sharedDimensions,
        sharedRadius,
        sharedFills,
        instances,
        inconsistencies: {
          hasRadiusMismatch,
          hasColorMismatch,
          hasDimensionMismatch,
          details
        }
      });
    }
    return clusters.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
  }

  // src/main/exportEngine.ts
  function sanitizePathSegment(segment) {
    return segment.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
  }
  function getMeaningfulParentFolder(node) {
    const meaningfulNames = [];
    let curr = node.parent;
    while (curr && curr.type !== "PAGE" && curr.type !== "DOCUMENT") {
      const name = sanitizePathSegment(curr.name);
      if (name && !/^Frame\s*\d+$/i.test(name)) {
        meaningfulNames.unshift(name);
      }
      curr = curr.parent;
    }
    return meaningfulNames.slice(-2).join("/");
  }
  function resolveRelativePath(node, pageName, folderMode) {
    const cleanName = sanitizePathSegment(node.name);
    if (folderMode === "slash") {
      if (node.name.includes("/")) {
        const parts = node.name.split("/").map((p) => sanitizePathSegment(p)).filter(Boolean);
        return parts.join("/");
      }
      const parentFolder = getMeaningfulParentFolder(node);
      return parentFolder ? `${parentFolder}/${cleanName}` : cleanName;
    }
    if (folderMode === "hierarchy") {
      const ancestors = [];
      let curr = node.parent;
      while (curr && curr.type !== "PAGE" && curr.type !== "DOCUMENT") {
        const parentName = sanitizePathSegment(curr.name);
        if (parentName) {
          ancestors.unshift(parentName);
        }
        curr = curr.parent;
      }
      const folder = ancestors.filter(Boolean).join("/");
      const safePage = sanitizePathSegment(pageName);
      return folder ? `${safePage}/${folder}/${cleanName}` : `${safePage}/${cleanName}`;
    }
    return cleanName;
  }
  async function processBatchExport(request) {
    const { nodeIds, format, scale, folderMode } = request;
    const total = nodeIds.length;
    const CHUNK_SIZE = 12;
    let processedCount = 0;
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunkIds = nodeIds.slice(i, i + CHUNK_SIZE);
      for (const id of chunkIds) {
        const node = figma.getNodeById(id);
        if (!node) {
          processedCount++;
          continue;
        }
        try {
          const page = getPageOfNode(node);
          const pageName = page ? page.name : "Icons";
          const relativePath = resolveRelativePath(node, pageName, folderMode);
          const exportSettings = format === "SVG" ? {
            format: "SVG",
            svgIdAttribute: false,
            svgOutlineText: true,
            svgSimplifyStroke: true
          } : format === "PDF" ? {
            format: "PDF"
          } : {
            format: "PNG",
            constraint: { type: "SCALE", value: scale }
          };
          const bytes = await node.exportAsync(exportSettings);
          processedCount++;
          const msg = {
            type: "EXPORT_CHUNK",
            current: processedCount,
            total,
            item: {
              id: node.id,
              name: sanitizePathSegment(node.name),
              relativePath,
              bytes: Array.from(bytes)
            }
          };
          figma.ui.postMessage(msg);
        } catch (err) {
          console.error(`Failed to export node ${node.name} (${node.id}):`, err);
          processedCount++;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const completeMsg = { type: "EXPORT_COMPLETE" };
    figma.ui.postMessage(completeMsg);
  }
  function getPageOfNode(node) {
    let curr = node;
    while (curr) {
      if (curr.type === "PAGE") return curr;
      curr = curr.parent;
    }
    return null;
  }

  // src/main/code.ts
  figma.showUI(__html__, {
    width: 740,
    height: 760,
    themeColors: true,
    title: "Asset, Color & Component Extractor"
  });
  figma.on("selectionchange", () => {
    const count = figma.currentPage.selection.length;
    const msg = {
      type: "SELECTION_CHANGED",
      count
    };
    figma.ui.postMessage(msg);
  });
  var currentScanSessionId = 0;
  function bytesToSvgString(bytes) {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      let str = "";
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  }
  async function streamIconPreviews(icons, sessionId) {
    const PREVIEW_CHUNK_SIZE = 18;
    for (let i = 0; i < icons.length; i += PREVIEW_CHUNK_SIZE) {
      if (sessionId !== currentScanSessionId) return;
      const chunk = icons.slice(i, i + PREVIEW_CHUNK_SIZE);
      const previews = [];
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const node = figma.getNodeById(item.id);
            if (node) {
              const bytes = await node.exportAsync({
                format: "SVG",
                svgIdAttribute: false,
                svgOutlineText: true,
                svgSimplifyStroke: true
              });
              previews.push({
                id: item.id,
                svg: bytesToSvgString(bytes)
              });
            }
          } catch {
          }
        })
      );
      if (sessionId !== currentScanSessionId) return;
      if (previews.length > 0) {
        figma.ui.postMessage({
          type: "ICON_PREVIEWS_CHUNK",
          previews
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
  async function streamComponentPreviews(components, sessionId) {
    const CHUNK_SIZE = 6;
    for (let i = 0; i < components.length; i += CHUNK_SIZE) {
      if (sessionId !== currentScanSessionId) return;
      const chunk = components.slice(i, i + CHUNK_SIZE);
      const previews = [];
      await Promise.all(
        chunk.map(async (cluster) => {
          try {
            const node = figma.getNodeById(cluster.representativeNodeId);
            if (node) {
              const bytes = await node.exportAsync({
                format: "SVG",
                svgIdAttribute: false,
                svgOutlineText: true,
                svgSimplifyStroke: true
              });
              previews.push({
                id: cluster.clusterId,
                svg: bytesToSvgString(bytes)
              });
            }
          } catch {
          }
        })
      );
      if (sessionId !== currentScanSessionId) return;
      if (previews.length > 0) {
        figma.ui.postMessage({
          type: "COMPONENT_PREVIEWS_CHUNK",
          previews
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  figma.ui.onmessage = async (msg) => {
    try {
      if (msg.type === "CLOSE_PLUGIN") {
        figma.closePlugin();
        return;
      }
      if (msg.type === "RESIZE_WINDOW") {
        const w = Math.max(500, Math.min(2400, Math.round(msg.width)));
        const h = Math.max(500, Math.min(1800, Math.round(msg.height)));
        figma.ui.resize(w, h);
        return;
      }
      if (msg.type === "SELECT_NODE") {
        const node = figma.getNodeById(msg.id);
        if (node) {
          figma.currentPage.selection = [node];
          figma.viewport.scrollAndZoomIntoView([node]);
        }
        return;
      }
      if (msg.type === "SCAN_PROJECT") {
        currentScanSessionId++;
        const thisSessionId = currentScanSessionId;
        const { config } = msg;
        let targetNodes = [];
        const allIcons = [];
        if (config.scope === "selection") {
          targetNodes = [...figma.currentPage.selection];
          if (targetNodes.length === 0) {
            figma.ui.postMessage({
              type: "ERROR",
              message: "No layers selected. Please select frames or components to scan."
            });
            return;
          }
          allIcons.push(...scanForIcons(targetNodes, figma.currentPage.name, config));
        } else if (config.scope === "page") {
          targetNodes = [...figma.currentPage.children];
          allIcons.push(...scanForIcons(targetNodes, figma.currentPage.name, config));
        } else if (config.scope === "document") {
          for (const page of figma.root.children) {
            const pageIcons = scanForIcons(page.children, page.name, config);
            allIcons.push(...pageIcons);
            targetNodes.push(...page.children);
          }
        }
        const colors = extractProjectColors(targetNodes);
        const typography = extractProjectTypography(targetNodes);
        const components = auditProjectComponents(targetNodes);
        const response = {
          type: "SCAN_COMPLETE",
          icons: allIcons,
          colors,
          typography,
          components
        };
        figma.ui.postMessage(response);
        streamIconPreviews(allIcons, thisSessionId);
        streamComponentPreviews(components, thisSessionId);
      }
      if (msg.type === "START_EXPORT") {
        await processBatchExport(msg.request);
      }
    } catch (error) {
      console.error("Plugin runtime error:", error);
      figma.ui.postMessage({
        type: "ERROR",
        message: error?.message || "An unexpected error occurred during execution."
      });
    }
  };
})();

const css = require('css');
const EOF = Symbol('EOF'); // EOF: End of file

const stack = [{
  type: 'document',
  children: []
}];

let currentToken = null; // 当前 token
let currentAttribute = null; // 当前 属性
let currentTextNode = null; // 当前 文本节点
let rules = []; // css 规则

function addCSSRules(text) {
  let ast = css.parse(text)
  // css 中的注释也会解析进去，所以要过滤一下没有 selectors 的 rules
  rules = [...ast.stylesheet.rules].filter((v) => v.selectors)
}

// 计算是否与当前的元素匹配
function match(element, selector) {
  if (!selector || !element.attributes) {
    return false
  }
  if (selector.charAt(0) == '#') {
    var attr = element.attributes.filter(attr => attr.name === 'id')[0]
    if (attr && attr.value === selector.replace('#', '')) {
      return true
    }
  } else if (selector.charAt(0) == '.') {
    var attr = element.attributes.filter(attr => attr.name === 'class')[0]
    if (attr && attr.value === selector.replace('#', '')) {
      return true
    }
  } else {
    if (element.tagName === selector) {
      return true
    }
  }
  return false
}

// specificity的计算逻辑
function specificity(selector) {
  var p = [0, 0, 0, 0]
  var selectorParts = selector.split(' ') // 分割选择器
  for (var part of selectorParts) {
    if (part.charAt(0) == '#') {
      p[1] += 1
    } else if (part.charAt(0) == '.') {
      p[2] += 1
    } else {
      p[3] += 1
    }
    // 解析复合选择器div.cls#id ????
  }
  return p
}

function compare(sp1, sp2) {
  if (sp1[0] - sp2[0]) {
    return sp1[0] - sp2[0]
  }
  if (sp1[1] - sp2[1]) {
    return sp1[1] - sp2[1]
  }
  if (sp1[2] - sp2[2]) {
    return sp1[2] - sp2[2]
  }

  return sp1[3] - sp2[3]
}

// 处理简单选择器
function computeCSS(element) {
  // 对父元素的序列进行reverse
  var elements = stack.slice().reverse() // 不影响原始数组，对数组进行反转
  if (!element.computedStyle) {
    element.computedStyle = {}
  }

  for (let rule of rules) {
    var selectorParts = rule.selectors[0].split(' ').reverse()

    if (!match(element, selectorParts[0])) {
      continue
    }
    let matched = false
    var j = 1
    for (var i = 0; i < elements.length; i++) {
      if (match(elements[i]), selectorParts[j]) {
        j++;
      }
    }
    // 判断选择器是否都被匹配到
    if (j >= selectorParts.length) {
      matched = true
    }
    if (matched) {
      var sp = specificity(rule.selectors[0])
      //选择匹配，就应用选择器到元素上，形成computedStyle
      var computedStyle = element.computedStyle
      for (var declaration of rule.declarations) {
        if (!computedStyle[declaration.property]) {
          computedStyle[declaration.property] = {}
        }

        // 选择器优先级的判断
        if (!computedStyle[declaration.property].specificity) {
          computedStyle[declaration.property].value = declaration.value
          computedStyle[declaration.property].specificity = sp
        } else if (compare(computedStyle[declaration.property].specificity, sp) < 0) {
          computedStyle[declaration.property].value = declaration.value
          computedStyle[declaration.property].specificity = sp
        }
      }
    }
  }
}

function emit(token) {
  // 栈顶元素
  let top = stack[stack.length - 1];

  // 开始标签
  if (token.type === 'startTag') {
    let element = {
      type: 'element',
      children: [],
      attributes: [],
    };

    element.tagName = token.tagName;

    // 属性收集
    for (const p in token) {
      if (p !== 'type' && p !== 'tagName') {
        element.attributes.push({
          name: p,
          value: token[p],
        });
      }
    }

    // 计算 CSS 属性
    computeCSS(element);

    // 栈顶元素为当前element的父元素
    element.parent = top
    top.children.push(element);

    // 如果非自封闭标签，将该元素入栈
    if (!token.isSelfClosing) {
      stack.push(element);
    }

    // 当前文本节点置空
    currentTextNode = null;
  }
  // 结束标签
  else if (token.type === 'endTag') {
    if (top.tagName !== token.tagName) {
      throw new Error("Tag start end doesn't match");
    } else {
      // 遇到 style 标签，添加 css 规则
      if (top.tagName === 'style') {
        addCSSRules(top.children[0].content);
      }
      // 结束标签出栈
      stack.pop();
    }
    // 当前文本节点置空
    currentTextNode = null;
  }
  // 文本节点
  else if (token.type === 'text') {
    if (currentTextNode == null) {
      // 初始化文本节点
      currentTextNode = {
        type: 'text',
        content: '',
      };

      // 文本节点为当前栈顶元素子元素
      top.children.push(currentTextNode);
    }

    // 文本内容合并
    currentTextNode.content += token.content;
  }
}

function data(c) {
  if (c === '<') {
    return tagOpen;
  } else if (c === EOF) {
    emit({
      type: 'EOF',
    });
    return;
  } else {
    emit({
      type: 'text',
      content: c
    });
    return data;
  }
}

function tagOpen(c) {
  if (c === '/') {
    return endTagOpen;
  } else if (c.match(/[a-zA-Z]/)) {
    currentToken = {
      type: 'startTag',
      tagName: '',
    }
    return tagName(c);
  } else {
    return '';
  }
}

function endTagOpen(c) {
  if (c.match(/[a-zA-Z]/)) {
    currentToken = {
      type: 'endTag',
      tagName: '',
    }
    return tagName(c);
  } else if (c === '>') {

  } else if (c === EOF) {

  } else {

  }
}

function tagName(c) {
  if (c.match(/[\t\n\f ]/)) {
    return beforeAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c.match(/[a-zA-Z]/)) {
    currentToken.tagName += c;
    return tagName;
  } else if (c === '>') {
    emit(currentToken);
    return data;
  } else {
    return tagName;
  }
}

function selfClosingStartTag(c) {
  if (c === '>') {
    currentToken.isSelfClosing = true;
    emit(currentToken);
    return data;
  } else if (c === EOF) {

  } else {

  }
}

function beforeAttributeName(c) {
  if (c.match(/[\t\n\f ]/)) {
    return beforeAttributeName;
  } else if (c === '/' || c === '>' || c === EOF) {
    return afterAttributeName(c);
  } else if (c === '=') {

  } else {
    currentAttribute = {
      name: '',
      value: ''
    }
    return attributeName(c);
  }
}

function attributeName(c) {
  if (c.match(/[\t\n\f ]/) || c === '/' || c === '>' || c === EOF) {
    return afterAttributeName(c);
  } else if (c === '=') {
    return beforeAttributeValue;
  } else if (c === '\u0000') {} else if (c === "'" || c === '"' || c === '<') {} else {
    // 属性名称合并
    currentAttribute.name += c;
    return attributeName;
  }
}

function afterAttributeName(c) {
  if (c.match(/[\t\n\f ]/)) {
    return afterAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c === '=') {
    return beforeAttributeValue;
  } else if (c === '>') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c === EOF) {} else {
    currentToken[currentAttribute.name] = currentAttribute.value;
    currentAttribute = {
      name: '',
      value: '',
    };
    return attributeName(c);
  }
}

function beforeAttributeValue(c) {
  if (c.match(/[\t\n\f ]/) || c === '/' || c === '>' || c === EOF) {
    return beforeAttributeValue;
  } else if (c === '"') {
    return doubleQuotedAttributeValue;
  } else if (c === "'") {
    return singleQuotedAttributeValue;
  } else if (c === '>') {} else {
    return UnquotedAttributeValue(c);
  }
}

function doubleQuotedAttributeValue(c) {
  if (c === '"') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {} else if (c === EOF) {} else {
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}

function singleQuotedAttributeValue(c) {
  if (c === '\'') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {} else if (c === EOF) {} else {
    currentAttribute.value += c;
    return singleQuotedAttributeValue;
  }
}

function UnquotedAttributeValue(c) {
  if (c.match(/[\t\n\f ]/)) {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return beforeAttributeName;
  } else if (c === '/') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return selfClosingStartTag;
  } else if (c === '>') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c === '\u0000') {} else if (c === '>') {} else if (c === "'" || c === '"' || c === '<' || c === '=' || c === '`') {} else if (c === EOF) {} else {
    currentAttribute.value += c;
    return UnquotedAttributeValue;
  }
}

function afterQuotedAttributeValue(c) {
  if (c.match(/[\t\n\f ]/)) {
    return beforeAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c === '>') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c === EOF) {} else {
    currentAttribute.value += c;
    return afterQuotedAttributeValue;
  }
}

module.exports.parseHtml = function parseHtml(html) {
  let state = data;
  for (let c of html) {
    state = state(c);
  }

  state = state(EOF);

  return stack[0];
}
const { expect } = require('chai');
const sinon = require('sinon');
const babel = require('@babel/core');
const babelPluginIconUpdate = require('../src/babel-plugin-icon-update.js');

function executeBabel(input, options) {
  const result = babel.transform(input, {
    plugins: [[babelPluginIconUpdate, options]],
  });
  return result.code;
}

const oldToNewMap = {
  'brand:set:icon': 'brand:newSetName:newIconName',
  'brand2:set2:icon2': 'brand2:newSetName2:newIconName2',
};

describe('babel-plugin-icon-update', () => {
  it('replaces icon-id attributes', () => {
    const code = `
      function render() {
        return html\`<lion-icon icon-id="brand:set:icon"></lion-icon>\`;
      }`;
    const output = `
      function render() {
        return html\`<lion-icon icon-id="brand:newSetName:newIconName"></lion-icon>\`;
      }`;
    expect(executeBabel(code, { oldToNewMap })).to.equal(output);
  });

  it('replaces .iconId properties', () => {
    const code = `
      function render() {
        return html\`<lion-icon icon-id="brand:set:icon"></lion-icon>\`;
      }`;
    const output = `
      function render() {
        return html\`<lion-icon icon-id="brand:newSetName:newIconName"></lion-icon>\`;
      }`;
    expect(executeBabel(code, { oldToNewMap })).to.equal(output);
  });

  it('supports template literal expressions', () => {
    const code = `
      function render() {
        return html\`<lion-icon icon-id="\${'brand:set:icon'}"></lion-icon>\`;
      }`;
    const output = `
      function render() {
        return html\`<lion-icon icon-id="\${'brand:newSetName:newIconName'}"></lion-icon>\`;
      }`;
    expect(executeBabel(code, { oldToNewMap })).to.equal(output);
  });

  // Technically possible, but not part of first release
  it.skip('supports Identfier expressions', () => {
    const code = `
      const myIcon = 'brand:set:icon';
      function render() {
        return html\`<lion-icon icon-id="\${myIcon}"></lion-icon>\`;
      }`;
    const output = `
      const myIcon = 'brand:newSetName:newIconName';
      function render() {
        return html\`<lion-icon icon-id="\${myIcon}"></lion-icon>\`;
      }`;
    expect(executeBabel(code, { oldToNewMap })).to.equal(output);
  });

  it('notifies about non template literal expressions', () => {
    sinon.spy(console, 'warn');
    const code = `
      function render() {
        return html\`<lion-icon icon-id="brand:set:\${'bla'}"></lion-icon>\`;
      }`;
    const output = `
      function render() {
        return html\`<lion-icon icon-id="brand:set:\${'bla'}"></lion-icon>\`;
      }`;
    const result = executeBabel(code, { oldToNewMap });
    expect(result).to.equal(output);
    expect(console.warn.args[0][0]).to.eql(`Please manually update icon-id="brand:set:\${'bla'}"`);
  });

  it('works in larger templates', () => {
    const code = `
      function render() {
        return html\`
          <div>
            <lion-icon icon-id="brand:set:icon"></lion-icon>
          </div>
          <span>
            <lion-icon icon-id="brand2:set2:icon2"></lion-icon>
          </span>
        \`;
      }`;
    const output = `
      function render() {
        return html\`
          <div>
            <lion-icon icon-id="brand:newSetName:newIconName"></lion-icon>
          </div>
          <span>
            <lion-icon icon-id="brand2:newSetName2:newIconName2"></lion-icon>
          </span>
        \`;
      }`;
    expect(executeBabel(code, { oldToNewMap })).to.equal(output);
  });
});
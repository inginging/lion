import { LitElement } from '@lion/core';
import { localizeTearDown } from '@lion/localize/test-helpers.js';
import {
  defineCE,
  expect,
  html,
  triggerFocusFor,
  unsafeStatic,
  fixture,
  aTimeout,
} from '@open-wc/testing';
import sinon from 'sinon';
import { LionField, IsNumber, Validator } from '@lion/form-core';
import '@lion/form-core/lion-field.js';
import { FormGroupMixin } from '../../src/form-group/FormGroupMixin.js';

/**
 * @typedef {import('../../types/FormControlMixinTypes').FormControlHost} FormControlHost
 */

const FormChild = class extends LionField {
  get slots() {
    return {
      ...super.slots,
      input: () => document.createElement('input'),
    };
  }
};
const childTagString = defineCE(FormChild);

// @ts-expect-error
const FormGroup = class extends FormGroupMixin(LitElement) {
  constructor() {
    super();
    /** @override from FormRegistrarMixin */
    this._isFormOrFieldset = true;
    this._repropagationRole = 'fieldset'; // configures FormControlMixin
  }
};

const tagString = defineCE(FormGroup);
const tag = unsafeStatic(tagString);
const childTag = unsafeStatic(childTagString);
const inputSlots = html`
  <${childTag} name="gender[]"></${childTag}>
  <${childTag} name="gender[]"></${childTag}>
  <${childTag} name="color"></${childTag}>
  <${childTag} name="hobbies[]"></${childTag}>
  <${childTag} name="hobbies[]"></${childTag}>
`;

beforeEach(() => {
  localizeTearDown();
});

describe('FormGroupMixin', () => {
  // TODO: Tests below belong to FormControlMixin. Preferably run suite integration test
  it(`has a fieldName based on the label`, async () => {
    const el1 = /**  @type {FormGroup} */ (await fixture(
      html`<${tag} label="foo">${inputSlots}</${tag}>`,
    ));
    expect(el1.fieldName).to.equal(el1._labelNode.textContent);

    const el2 = /**  @type {FormGroup} */ (await fixture(
      html`<${tag}><label slot="label">bar</label>${inputSlots}</${tag}>`,
    ));
    expect(el2.fieldName).to.equal(el2._labelNode.textContent);
  });

  it(`has a fieldName based on the name if no label exists`, async () => {
    const el = /**  @type {FormGroup} */ (await fixture(
      html`<${tag} name="foo">${inputSlots}</${tag}>`,
    ));
    expect(el.fieldName).to.equal(el.name);
  });

  it(`can override fieldName`, async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag} label="foo" .fieldName="${'bar'}">${inputSlots}</${tag}>
    `));
    expect(el.__fieldName).to.equal(el.fieldName);
  });

  // TODO: Tests below belong to FormRegistrarMixin. Preferably run suite integration test
  it(`${tagString} has an up to date list of every form element in .formElements`, async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}>${inputSlots}</${tag}>`));
    expect(el.formElements._keys().length).to.equal(3);
    expect(el.formElements['hobbies[]'].length).to.equal(2);
    el.removeChild(el.formElements['hobbies[]'][0]);
    expect(el.formElements._keys().length).to.equal(3);
    expect(el.formElements['hobbies[]'].length).to.equal(1);
  });

  it(`supports in html wrapped form elements`, async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <div>
          <${childTag} name="foo"></${childTag}>
        </div>
      </${tag}>
    `));
    expect(el.formElements.length).to.equal(1);
    el.children[0].removeChild(el.formElements.foo);
    expect(el.formElements.length).to.equal(0);
  });

  it('handles names with ending [] as an array', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}>${inputSlots}</${tag}>`));
    el.formElements['gender[]'][0].modelValue = { value: 'male' };
    el.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'chess' };
    el.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };

    expect(el.formElements._keys().length).to.equal(3);
    expect(el.formElements['hobbies[]'].length).to.equal(2);
    expect(el.formElements['hobbies[]'][0].modelValue.value).to.equal('chess');
    expect(el.formElements['gender[]'][0].modelValue.value).to.equal('male');
    expect(el.modelValue['hobbies[]']).to.deep.equal([
      { checked: false, value: 'chess' },
      { checked: false, value: 'rugby' },
    ]);
  });

  it('throws if an element without a name tries to register', async () => {
    const orig = console.info;
    console.info = () => {};

    let error;
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}></${tag}>`));
    try {
      // we test the api directly as errors thrown from a web component are in a
      // different context and we can not catch them here => register fake elements
      // @ts-expect-error
      el.addFormElement(/**  @type {FormControlHost} */ ({}));
    } catch (err) {
      error = err;
    }
    expect(error).to.be.instanceOf(TypeError);
    expect(error.message).to.equal('You need to define a name');

    console.info = orig; // restore original console
  });

  it('throws if name is the same as its parent', async () => {
    const orig = console.info;
    console.info = () => {};

    let error;
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag} name="foo"></${tag}>`));
    try {
      // we test the api directly as errors thrown from a web component are in a
      // different context and we can not catch them here => register fake elements
      // @ts-expect-error
      el.addFormElement(/**  @type {FormControlHost} */ ({ name: 'foo' }));
    } catch (err) {
      error = err;
    }
    expect(error).to.be.instanceOf(TypeError);
    expect(error.message).to.equal('You can not have the same name "foo" as your parent');

    console.info = orig; // restore original console
  });

  it('throws if same name without ending [] is used', async () => {
    const orig = console.info;
    console.info = () => {};

    let error;
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}></${tag}>`));
    try {
      // we test the api directly as errors thrown from a web component are in a
      // different context and we can not catch them here => register fake elements
      // @ts-expect-error
      el.addFormElement(/**  @type {FormControlHost} */ ({ name: 'fooBar' }));
      // @ts-expect-error
      el.addFormElement(/**  @type {FormControlHost} */ ({ name: 'fooBar' }));
    } catch (err) {
      error = err;
    }
    expect(error).to.be.instanceOf(TypeError);
    expect(error.message).to.equal(
      'Name "fooBar" is already registered - if you want an array add [] to the end',
    );

    console.info = orig; // restore original console
  });
  /* eslint-enable no-console */

  it('can dynamically add/remove elements', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}>${inputSlots}</${tag}>`));
    const newField = /**  @type {FormGroup} */ (await fixture(
      html`<${childTag} name="lastName"></${childTag}>`,
    ));

    expect(el.formElements._keys().length).to.equal(3);

    el.appendChild(newField);
    expect(el.formElements._keys().length).to.equal(4);

    el._inputNode.removeChild(newField);
    expect(el.formElements._keys().length).to.equal(3);
  });

  // TODO: Tests below belong to FormGroupMixin. Preferably run suite integration test

  it('can read/write all values (of every input) via this.modelValue', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <${childTag} name="lastName"></${childTag}>
        <${tag} name="newfieldset">${inputSlots}</${tag}>
      </${tag}>
    `));
    const newFieldset = /**  @type {FormGroup} */ (el.querySelector(tagString));
    el.formElements.lastName.modelValue = 'Bar';
    newFieldset.formElements['hobbies[]'][0].modelValue = { checked: true, value: 'chess' };
    newFieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'football' };
    newFieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
    newFieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
    newFieldset.formElements.color.modelValue = { checked: false, value: 'blue' };

    expect(el.modelValue).to.deep.equal({
      lastName: 'Bar',
      newfieldset: {
        'hobbies[]': [
          { checked: true, value: 'chess' },
          { checked: false, value: 'football' },
        ],
        'gender[]': [
          { checked: false, value: 'male' },
          { checked: false, value: 'female' },
        ],
        color: { checked: false, value: 'blue' },
      },
    });

    // make sure values are full settled before changing them
    await aTimeout(0);
    el.modelValue = {
      lastName: 2,
      newfieldset: {
        'hobbies[]': [
          { checked: true, value: 'chess' },
          { checked: false, value: 'baseball' },
        ],
        'gender[]': [
          { checked: false, value: 'male' },
          { checked: false, value: 'female' },
        ],
        color: { checked: false, value: 'blue' },
      },
    };

    expect(newFieldset.formElements['hobbies[]'][0].modelValue).to.deep.equal({
      checked: true,
      value: 'chess',
    });
    expect(newFieldset.formElements['hobbies[]'][1].modelValue).to.deep.equal({
      checked: false,
      value: 'baseball',
    });
    expect(el.formElements.lastName.modelValue).to.equal(2);
  });

  it('works with document.createElement', async () => {
    const el = /** @type {FormGroup} */ (document.createElement(tagString));
    const childEl = /** @type {FormChild} */ (document.createElement(childTagString));
    childEl.name = 'planet';
    childEl.modelValue = 'earth';
    expect(el.formElements.length).to.equal(0);

    const wrapper = await fixture('<div></div>');
    el.appendChild(childEl);
    wrapper.appendChild(el);

    expect(el.formElements.length).to.equal(1);

    await el.registrationComplete;
    expect(el.modelValue).to.deep.equal({ planet: 'earth' });
  });

  it('does not list disabled values in this.modelValue', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <${childTag} name="a" disabled .modelValue="${'x'}"></${childTag}>
        <${childTag} name="b" .modelValue="${'x'}"></${childTag}>
        <${tag} name="newFieldset">
          <${childTag} name="c" .modelValue="${'x'}"></${childTag}>
          <${childTag} name="d" disabled .modelValue="${'x'}"></${childTag}>
        </${tag}>
        <${tag} name="disabledFieldset" disabled>
          <${childTag} name="e" .modelValue="${'x'}"></${childTag}>
        </${tag}>
      </${tag}>
    `));
    expect(el.modelValue).to.deep.equal({
      b: 'x',
      newFieldset: {
        c: 'x',
      },
    });
  });

  it('does not throw if setter data of this.modelValue can not be handled', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <${childTag} name="firstName" .modelValue=${'foo'}></${childTag}>
        <${childTag} name="lastName" .modelValue=${'bar'}></${childTag}>
      </${tag}>
    `));
    const initState = {
      firstName: 'foo',
      lastName: 'bar',
    };
    expect(el.modelValue).to.deep.equal(initState);

    // @ts-expect-error
    el.modelValue = undefined;
    expect(el.modelValue).to.deep.equal(initState);

    // @ts-expect-error
    el.modelValue = null;
    expect(el.modelValue).to.deep.equal(initState);
  });

  it('disables/enables all its formElements if it becomes disabled/enabled', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(
      html`<${tag} disabled>${inputSlots}</${tag}>`,
    ));
    expect(el.formElements.color.disabled).to.be.true;
    expect(el.formElements['hobbies[]'][0].disabled).to.be.true;
    expect(el.formElements['hobbies[]'][1].disabled).to.be.true;

    el.disabled = false;
    await el.updateComplete;
    expect(el.formElements.color.disabled).to.equal(false);
    expect(el.formElements['hobbies[]'][0].disabled).to.equal(false);
    expect(el.formElements['hobbies[]'][1].disabled).to.equal(false);
  });

  it('does not propagate/override initial disabled value on nested form elements', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <${tag} name="sub" disabled>${inputSlots}</${tag}>
      </${tag}>
    `));

    expect(el.disabled).to.equal(false);
    expect(el.formElements.sub.disabled).to.be.true;
    expect(el.formElements.sub.formElements.color.disabled).to.be.true;
    expect(el.formElements.sub.formElements['hobbies[]'][0].disabled).to.be.true;
    expect(el.formElements.sub.formElements['hobbies[]'][1].disabled).to.be.true;
  });

  it('can set initial modelValue on creation', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag} .modelValue=${{ lastName: 'Bar' }}>
        <${childTag} name="lastName"></${childTag}>
      </${tag}>
    `));

    expect(el.modelValue).to.eql({
      lastName: 'Bar',
    });
  });

  it('can set initial serializedValue on creation', async () => {
    const el = /**  @type {FormGroup} */ (await fixture(html`
      <${tag} .modelValue=${{ lastName: 'Bar' }}>
        <${childTag} name="lastName"></${childTag}>
      </${tag}>
    `));

    expect(el.modelValue).to.eql({ lastName: 'Bar' });
  });

  describe('Validation', () => {
    it('validates on init', async () => {
      class IsCat extends Validator {
        static get validatorName() {
          return 'IsCat';
        }

        /**
         * @param {string} value
         */
        execute(value) {
          const hasError = value !== 'cat';
          return hasError;
        }
      }

      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="color" .validators=${[
        new IsCat(),
      ]} .modelValue=${'blue'}></${childTag}>
        </${tag}>
      `));
      expect(el.formElements.color.validationStates.error.IsCat).to.be.true;
    });

    it('validates when a value changes', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}>${inputSlots}</${tag}>`));

      const spy = sinon.spy(el, 'validate');
      el.formElements.color.modelValue = { checked: true, value: 'red' };
      expect(spy.callCount).to.equal(1);
    });

    it('has a special validator for all children - can be checked via this.error.FormElementsHaveNoError', async () => {
      class IsCat extends Validator {
        static get validatorName() {
          return 'IsCat';
        }

        /**
         * @param {string} value
         */
        execute(value) {
          const hasError = value !== 'cat';
          return hasError;
        }
      }

      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="color" .validators=${[
        new IsCat(),
      ]} .modelValue=${'blue'}></${childTag}>
        </${tag}>
      `));

      expect(el.validationStates.error.FormElementsHaveNoError).to.be.true;
      expect(el.formElements.color.validationStates.error.IsCat).to.be.true;
      el.formElements.color.modelValue = 'cat';
      expect(el.validationStates.error).to.deep.equal({});
    });

    it('validates on children (de)registration', async () => {
      class HasEvenNumberOfChildren extends Validator {
        static get validatorName() {
          return 'HasEvenNumberOfChildren';
        }

        /**
         * @param {string} value
         */
        execute(value) {
          const hasError = Object.keys(value).length % 2 !== 0;
          return hasError;
        }
      }
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} .validators=${[new HasEvenNumberOfChildren()]}>
          <${childTag} id="c1" name="c1"></${childTag}>
        </${tag}>
      `));
      const child2 = /**  @type {FormGroup} */ (await fixture(html`
        <${childTag} name="c2"></${childTag}>
      `));
      expect(el.validationStates.error.HasEvenNumberOfChildren).to.be.true;

      el.appendChild(child2);
      expect(el.validationStates.error.HasEvenNumberOfChildren).to.equal(undefined);

      el.removeChild(child2);
      expect(el.validationStates.error.HasEvenNumberOfChildren).to.be.true;

      // Edge case: remove all children
      el.removeChild(/**  @type {Node} */ (el.querySelector('[id=c1]')));

      expect(el.validationStates.error.HasEvenNumberOfChildren).to.equal(undefined);
    });
  });

  describe('Interaction states', () => {
    it('has false states (dirty, touched, prefilled) on init', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      expect(fieldset.dirty).to.equal(false, 'dirty');
      expect(fieldset.touched).to.equal(false, 'touched');
      expect(fieldset.prefilled).to.equal(false, 'prefilled');
    });

    it('sets dirty when value changed', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      fieldset.formElements['hobbies[]'][0].modelValue = { checked: true, value: 'football' };
      expect(fieldset.dirty).to.be.true;
    });

    it('sets touched when last field in fieldset left after focus', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}>${inputSlots}</${tag}>`));

      await triggerFocusFor(el.formElements['hobbies[]'][0]._inputNode);
      await triggerFocusFor(
        el.formElements['hobbies[]'][el.formElements['gender[]'].length - 1]._inputNode,
      );
      const button = /**  @type {FormGroup} */ (await fixture(html`<button></button>`));
      button.focus();

      expect(el.touched).to.be.true;
    });

    it('sets attributes [touched][dirty]', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`<${tag}></${tag}>`));
      el.touched = true;
      await el.updateComplete;
      expect(el).to.have.attribute('touched');

      el.dirty = true;
      await el.updateComplete;
      expect(el).to.have.attribute('dirty');
    });

    it('becomes prefilled if all form elements are prefilled', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="input1" .modelValue="${'prefilled'}"></${childTag}>
          <${childTag} name="input2"></${childTag}>
        </${tag}>
      `));
      expect(el.prefilled).to.be.false;

      const el2 = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="input1" .modelValue="${'prefilled'}"></${childTag}>
          <${childTag} name="input2" .modelValue="${'prefilled'}"></${childTag}>
        </${tag}>
      `));
      expect(el2.prefilled).to.be.true;
    });

    it(`becomes "touched" once the last element of a group becomes blurred by keyboard
      interaction (e.g. tabbing through the checkbox-group)`, async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <label slot="label">My group</label>
          <${childTag} name="myGroup[]" label="Option 1" value="1"></${childTag}>
          <${childTag} name="myGroup[]" label="Option 2" value="2"></${childTag}>
        </${tag}>
      `));

      const button = /**  @type {HTMLButtonElement} */ (await fixture(`<button>Blur</button>`));

      expect(el.touched).to.equal(false, 'initially, touched state is false');
      el.children[2].focus();
      expect(el.touched).to.equal(false, 'focus is on second checkbox');
      button.focus();
      expect(el.touched).to.equal(
        true,
        `focus is on element behind second checkbox (group has blurred)`,
      );
    });

    it(`becomes "touched" once the group as a whole becomes blurred via mouse interaction after
      keyboard interaction (e.g. focus is moved inside the group and user clicks somewhere outside
      the group)`, async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="input1"></${childTag}>
          <${childTag} name="input2"></${childTag}>
        </${tag}>
      `));
      const el2 = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="input1"></${childTag}>
          <${childTag} name="input2"></${childTag}>
        </${tag}>
      `));

      const outside = /**  @type {HTMLButtonElement} */ (await fixture(
        html`<button>outside</button>`,
      ));

      outside.click();
      expect(el.touched, 'unfocused fieldset should stay untouched').to.be.false;

      el.children[1].focus();
      el.children[2].focus();
      expect(el.touched).to.be.false;

      outside.click(); // blur the group via a click
      outside.focus(); // a real mouse click moves focus as well
      expect(el.touched).to.be.true;
      expect(el2.touched).to.be.false;
    });

    it('potentially shows fieldset error message on interaction change', async () => {
      class Input1IsTen extends Validator {
        static get validatorName() {
          return 'Input1IsTen';
        }

        /**
         * @param {{ input1:number }} value
         */
        execute(value) {
          const hasError = value.input1 !== 10;
          return hasError;
        }
      }

      const outSideButton = /**  @type {FormGroup} */ (await fixture(
        html`<button>outside</button>`,
      ));
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} .validators=${[new Input1IsTen()]}>
          <${childTag} name="input1" .validators=${[new IsNumber()]}></${childTag}>
        </${tag}>
      `));
      const input1 = /** @type {FormChild} */ (el.querySelector('[name=input1]'));
      input1.modelValue = 2;
      input1.focus();
      outSideButton.focus();

      await el.updateComplete;
      expect(el.validationStates.error.Input1IsTen).to.be.true;
      expect(el.showsFeedbackFor).to.deep.equal(['error']);
    });

    it('show error if tabbing "out" of last ', async () => {
      class Input1IsTen extends Validator {
        static get validatorName() {
          return 'Input1IsTen';
        }

        // @ts-expect-error
        execute(value) {
          const hasError = value.input1 !== 10;
          return hasError;
        }
      }
      const outSideButton = /**  @type {FormGroup} */ (await fixture(
        html`<button>outside</button>`,
      ));
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} .validators=${[new Input1IsTen()]}>
          <${childTag} name="input1" .validators=${[new IsNumber()]}></${childTag}>
          <${childTag} name="input2" .validators=${[new IsNumber()]}></${childTag}>
        </${tag}>
      `));
      const inputs = el.querySelectorAll(childTagString);
      // @ts-expect-error
      inputs[1].modelValue = 2; // make it dirty
      // @ts-expect-error
      inputs[1].focus();

      outSideButton.focus();

      expect(el.validationStates.error.Input1IsTen).to.be.true;
      expect(el.hasFeedbackFor).to.deep.equal(['error']);
    });
  });

  // TODO: this should be tested in FormGroupMixin
  describe('serializedValue', () => {
    it('use form elements serializedValue', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      // @ts-expect-error
      fieldset.formElements['hobbies[]'][0].serializer = v => `${v.value}-serialized`;
      fieldset.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'Bar' };
      fieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };
      fieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
      fieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
      fieldset.formElements.color.modelValue = { checked: false, value: 'blue' };
      expect(fieldset.formElements['hobbies[]'][0].serializedValue).to.equal('Bar-serialized');
      expect(fieldset.serializedValue).to.deep.equal({
        'hobbies[]': ['Bar-serialized', { checked: false, value: 'rugby' }],
        'gender[]': [
          { checked: false, value: 'male' },
          { checked: false, value: 'female' },
        ],
        color: { checked: false, value: 'blue' },
      });
    });

    it('treats names with ending [] as arrays', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      fieldset.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'chess' };
      fieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };
      fieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
      fieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
      fieldset.formElements.color.modelValue = { checked: false, value: 'blue' };
      expect(fieldset.serializedValue).to.deep.equal({
        'hobbies[]': [
          { checked: false, value: 'chess' },
          { checked: false, value: 'rugby' },
        ],
        'gender[]': [
          { checked: false, value: 'male' },
          { checked: false, value: 'female' },
        ],
        color: { checked: false, value: 'blue' },
      });
    });

    it('0 is a valid value to be serialized', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(html`
      <${tag}>
        <${childTag} name="price"></${childTag}>
      </${tag}>`));
      fieldset.formElements.price.modelValue = 0;
      expect(fieldset.serializedValue).to.deep.equal({ price: 0 });
    });

    it('serializes undefined values as ""(nb radios/checkboxes are always serialized)', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="custom[]"></${childTag}>
          <${childTag} name="custom[]"></${childTag}>
        </${tag}>
      `));
      fieldset.formElements['custom[]'][0].modelValue = 'custom 1';
      fieldset.formElements['custom[]'][1].modelValue = undefined;

      expect(fieldset.serializedValue).to.deep.equal({
        'custom[]': ['custom 1', ''],
      });
    });

    it('allows for nested fieldsets', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} name="userData">
          <${childTag} name="comment"></${childTag}>
          <${tag} name="newfieldset">${inputSlots}</${tag}>
        </${tag}>
      `));
      const newFieldset = /**  @type {FormGroup} */ (fieldset.querySelector(tagString));
      newFieldset.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'chess' };
      newFieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };
      newFieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
      newFieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
      newFieldset.formElements.color.modelValue = { checked: false, value: 'blue' };
      fieldset.formElements.comment.modelValue = 'Foo';
      expect(fieldset.formElements._keys().length).to.equal(2);
      expect(newFieldset.formElements._keys().length).to.equal(3);
      expect(fieldset.serializedValue).to.deep.equal({
        comment: 'Foo',
        newfieldset: {
          'hobbies[]': [
            { checked: false, value: 'chess' },
            { checked: false, value: 'rugby' },
          ],
          'gender[]': [
            { checked: false, value: 'male' },
            { checked: false, value: 'female' },
          ],
          color: { checked: false, value: 'blue' },
        },
      });
    });

    it('does not serialize disabled values', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="custom[]"></${childTag}>
          <${childTag} name="custom[]"></${childTag}>
        </${tag}>
      `));
      fieldset.formElements['custom[]'][0].modelValue = 'custom 1';
      fieldset.formElements['custom[]'][1].disabled = true;

      expect(fieldset.serializedValue).to.deep.equal({
        'custom[]': ['custom 1'],
      });
    });

    it('will exclude form elements within a disabled fieldset', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} name="userData">
          <${childTag} name="comment"></${childTag}>
          <${tag} name="newfieldset">${inputSlots}</${tag}>
        </${tag}>
      `));

      const newFieldset = /**  @type {FormGroup} */ (fieldset.querySelector(tagString));
      fieldset.formElements.comment.modelValue = 'Foo';
      newFieldset.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'chess' };
      newFieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };
      newFieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
      newFieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
      newFieldset.formElements.color.modelValue = { checked: false, value: 'blue' };
      newFieldset.formElements.color.disabled = true;

      expect(fieldset.serializedValue).to.deep.equal({
        comment: 'Foo',
        newfieldset: {
          'hobbies[]': [
            { checked: false, value: 'chess' },
            { checked: false, value: 'rugby' },
          ],
          'gender[]': [
            { checked: false, value: 'male' },
            { checked: false, value: 'female' },
          ],
        },
      });

      newFieldset.formElements.color.disabled = false;
      expect(fieldset.serializedValue).to.deep.equal({
        comment: 'Foo',
        newfieldset: {
          'hobbies[]': [
            { checked: false, value: 'chess' },
            { checked: false, value: 'rugby' },
          ],
          'gender[]': [
            { checked: false, value: 'male' },
            { checked: false, value: 'female' },
          ],
          color: { checked: false, value: 'blue' },
        },
      });
    });
  });

  describe('Reset', () => {
    it('restores default values if changes were made', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} id="firstName" name="firstName" .modelValue="${'Foo'}"></${childTag}>
        </${tag}>
      `));
      await /** @type {FormChild} */ (el.querySelector(childTagString)).updateComplete;

      const input = /** @type {FormChild} */ (el.querySelector('#firstName'));

      input.modelValue = 'Bar';
      expect(el.modelValue).to.deep.equal({ firstName: 'Bar' });
      expect(input.modelValue).to.equal('Bar');

      el.resetGroup();
      expect(el.modelValue).to.deep.equal({ firstName: 'Foo' });
      expect(input.modelValue).to.equal('Foo');
    });

    it('restores default values of arrays if changes were made', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} id="firstName" name="firstName[]" .modelValue="${'Foo'}"></${childTag}>
        </${tag}>
      `));
      await /** @type {FormChild} */ (el.querySelector(childTagString)).updateComplete;

      const input = /**  @type {FormChild} */ (el.querySelector('#firstName'));

      input.modelValue = 'Bar';
      expect(el.modelValue).to.deep.equal({ 'firstName[]': ['Bar'] });
      expect(input.modelValue).to.equal('Bar');

      el.resetGroup();
      expect(el.modelValue).to.deep.equal({ 'firstName[]': ['Foo'] });
      expect(input.modelValue).to.equal('Foo');
    });

    it('restores default values of a nested fieldset if changes were made', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${tag} id="name" name="name[]">
            <${childTag} id="firstName" name="firstName" .modelValue="${'Foo'}"></${childTag}>
          </${tag}>
        </${tag}>
      `));
      await Promise.all([
        /**  @type {FormChild} */ (el.querySelector(tagString)).updateComplete,
        /** @type {FormChild} */ (el.querySelector(childTagString)).updateComplete,
      ]);

      const input = /**  @type {FormChild} */ (el.querySelector('#firstName'));
      const nestedFieldset = /**  @type {FormGroup} */ (el.querySelector('#name'));

      input.modelValue = 'Bar';
      expect(el.modelValue).to.deep.equal({ 'name[]': [{ firstName: 'Bar' }] });
      expect(nestedFieldset.modelValue).to.deep.equal({ firstName: 'Bar' });
      expect(input.modelValue).to.equal('Bar');

      el.resetGroup();
      expect(el.modelValue).to.deep.equal({ 'name[]': [{ firstName: 'Foo' }] });
      expect(nestedFieldset.modelValue).to.deep.equal({ firstName: 'Foo' });
      expect(input.modelValue).to.equal('Foo');
    });

    it('clears interaction state', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(
        html`<${tag} touched dirty>${inputSlots}</${tag}>`,
      ));
      // Safety check initially
      el._setValueForAllFormElements('prefilled', true);
      expect(el.dirty).to.equal(true, '"dirty" initially');
      expect(el.touched).to.equal(true, '"touched" initially');
      expect(el.prefilled).to.equal(true, '"prefilled" initially');

      // Reset all children states, with prefilled false
      el._setValueForAllFormElements('modelValue', {});
      el.resetInteractionState();
      expect(el.dirty).to.equal(false, 'not "dirty" after reset');
      expect(el.touched).to.equal(false, 'not "touched" after reset');
      expect(el.prefilled).to.equal(false, 'not "prefilled" after reset');

      // Reset all children states with prefilled true
      el._setValueForAllFormElements('modelValue', { checked: true }); // not prefilled
      el.resetInteractionState();
      expect(el.dirty).to.equal(false, 'not "dirty" after 2nd reset');
      expect(el.touched).to.equal(false, 'not "touched" after 2nd reset');
      // prefilled state is dependant on value
      expect(el.prefilled).to.equal(true, '"prefilled" after 2nd reset');
    });

    it('clears submitted state', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      fieldset.submitted = true;
      fieldset.resetGroup();
      expect(fieldset.submitted).to.equal(false);
      fieldset.formElements.forEach(el => {
        expect(el.submitted).to.equal(false);
      });
    });

    it('has correct validation afterwards', async () => {
      class IsCat extends Validator {
        static get validatorName() {
          return 'IsCat';
        }

        /**
         * @param {string} value
         */
        execute(value) {
          const hasError = value !== 'cat';
          return hasError;
        }
      }
      class ColorContainsA extends Validator {
        static get validatorName() {
          return 'ColorContainsA';
        }

        /**
         * @param {{ [x:string]:any }} value
         */
        execute(value) {
          let hasError = true;
          if (value && value.color) {
            hasError = value.color.indexOf('a') === -1;
          }
          return hasError;
        }
      }

      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag} .validators=${[new ColorContainsA()]}>
          <${childTag} name="color" .validators=${[new IsCat()]}></${childTag}>
          <${childTag} name="color2"></${childTag}>
        </${tag}>
      `));
      expect(el.hasFeedbackFor).to.deep.equal(['error']);
      expect(el.validationStates.error.ColorContainsA).to.be.true;
      expect(el.formElements.color.hasFeedbackFor).to.deep.equal([]);

      el.formElements.color.modelValue = 'onlyb';
      expect(el.hasFeedbackFor).to.deep.equal(['error']);
      expect(el.validationStates.error.ColorContainsA).to.be.true;
      expect(el.formElements.color.validationStates.error.IsCat).to.be.true;

      el.formElements.color.modelValue = 'cat';
      expect(el.hasFeedbackFor).to.deep.equal([]);

      el.resetGroup();
      expect(el.hasFeedbackFor).to.deep.equal(['error']);
      expect(el.validationStates.error.ColorContainsA).to.be.true;
      expect(el.formElements.color.hasFeedbackFor).to.deep.equal([]);
    });

    it('has access to `_initialModelValue` based on initial children states', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="child[]" .modelValue="${'foo1'}">
          </${childTag}>
          <${childTag} name="child[]" .modelValue="${'bar1'}">
          </${childTag}>
        </${tag}>
      `));
      await el.updateComplete;
      el.modelValue['child[]'] = ['foo2', 'bar2'];
      expect(el._initialModelValue['child[]']).to.eql(['foo1', 'bar1']);
    });

    it('does not wrongly recompute `_initialModelValue` after dynamic changes of children', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <${childTag} name="child[]" .modelValue="${'foo1'}">
          </${childTag}>
        </${tag}>
      `));
      el.modelValue['child[]'] = ['foo2'];
      const childEl = /**  @type {FormGroup} */ (await fixture(html`
        <${childTag} name="child[]" .modelValue="${'bar1'}">
        </${childTag}>
      `));
      el.appendChild(childEl);
      expect(el._initialModelValue['child[]']).to.eql(['foo1', 'bar1']);
    });

    describe('resetGroup method', () => {
      it('calls resetGroup on children fieldsets', async () => {
        const el = /**  @type {FormGroup} */ (await fixture(html`
          <${tag} name="parentFieldset">
            <${tag} name="childFieldset">
              <${childTag} name="child[]" .modelValue="${'foo1'}">
              </${childTag}>
            </${tag}>
          </${tag}>
        `));
        const childFieldsetEl = el.querySelector(tagString);
        // @ts-expect-error
        const resetGroupSpy = sinon.spy(childFieldsetEl, 'resetGroup');
        el.resetGroup();
        expect(resetGroupSpy.callCount).to.equal(1);
      });

      it('calls reset on children fields', async () => {
        const el = /**  @type {FormGroup} */ (await fixture(html`
          <${tag} name="parentFieldset">
            <${tag} name="childFieldset">
              <${childTag} name="child[]" .modelValue="${'foo1'}">
              </${childTag}>
            </${tag}>
          </${tag}>
        `));
        const childFieldsetEl = /** @type {FormChild} */ (el.querySelector(childTagString));
        const resetSpy = sinon.spy(childFieldsetEl, 'reset');
        el.resetGroup();
        expect(resetSpy.callCount).to.equal(1);
      });
    });

    describe('clearGroup method', () => {
      it('calls clearGroup on children fieldset', async () => {
        const el = /**  @type {FormGroup} */ (await fixture(html`
          <${tag} name="parentFieldset">
          <${tag} name="childFieldset">
              <${childTag} name="child[]" .modelValue="${'foo1'}">
              </${childTag}>
            </${tag}>
          </${tag}>
        `));
        const childFieldsetEl = el.querySelector(tagString);
        // @ts-expect-error
        const clearGroupSpy = sinon.spy(childFieldsetEl, 'clearGroup');
        el.clearGroup();
        expect(clearGroupSpy.callCount).to.equal(1);
      });

      it('calls clear on children fields', async () => {
        const el = /**  @type {FormGroup} */ (await fixture(html`
          <${tag} name="parentFieldset">
          <${tag} name="childFieldset">
              <${childTag} name="child[]" .modelValue="${'foo1'}">
              </${childTag}>
            </${tag}>
          </${tag}>
        `));
        const childFieldsetEl = /** @type {FormChild} */ (el.querySelector(childTagString));
        const clearSpy = sinon.spy(childFieldsetEl, 'clear');
        el.clearGroup();
        expect(clearSpy.callCount).to.equal(1);
      });

      it('should clear the value of  fields', async () => {
        const el = /**  @type {FormGroup} */ (await fixture(html`
          <${tag} name="parentFieldset">
          <${tag} name="childFieldset">
              <${childTag} name="child" .modelValue="${'foo1'}">
              </${childTag}>
            </${tag}>
          </${tag}>
        `));
        el.clearGroup();
        expect(/**  @type {FormChild} */ (el.querySelector('[name="child"]')).modelValue).to.equal(
          '',
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has role="group" set', async () => {
      const fieldset = /**  @type {FormGroup} */ (await fixture(
        html`<${tag}>${inputSlots}</${tag}>`,
      ));
      fieldset.formElements['hobbies[]'][0].modelValue = { checked: false, value: 'chess' };
      fieldset.formElements['hobbies[]'][1].modelValue = { checked: false, value: 'rugby' };
      fieldset.formElements['gender[]'][0].modelValue = { checked: false, value: 'male' };
      fieldset.formElements['gender[]'][1].modelValue = { checked: false, value: 'female' };
      fieldset.formElements.color.modelValue = { checked: false, value: 'blue' };
      expect(fieldset.hasAttribute('role')).to.be.true;
      expect(fieldset.getAttribute('role')).to.contain('group');
    });

    it('has an aria-labelledby from element with slot="label"', async () => {
      const el = /**  @type {FormGroup} */ (await fixture(html`
        <${tag}>
          <label slot="label">My Label</label>
          ${inputSlots}
        </${tag}>
      `));
      const label = /** @type {HTMLElement} */ (Array.from(el.children).find(
        child => child.slot === 'label',
      ));
      expect(el.hasAttribute('aria-labelledby')).to.equal(true);
      expect(el.getAttribute('aria-labelledby')).contains(label.id);
    });

    describe('Screen reader relations (aria-describedby) for child fields and fieldsets', () => {
      /** @type {Function} */
      let childAriaFixture;
      /** @type {Function} */
      let childAriaTest;

      before(() => {
        // Legend:
        // - l1 means level 1 (outer) fieldset
        // - l2 means level 2 (inner) fieldset
        // - g means group: the help-text or feedback belongs to group
        // - f means field(lion-input in fixture below): the help-text or feedback belongs to field
        // - 'a' or 'b' behind 'f' indicate which field in a fieldset is meant (a: first, b: second)

        childAriaFixture = async (
          msgSlotType = 'feedback', // eslint-disable-line no-shadow
        ) => {
          const dom = /**  @type {FormGroup} */ (await fixture(html`
            <${tag} name="l1_g">
              <${childTag} name="l1_fa">
                <div slot="${msgSlotType}" id="msg_l1_fa"></div>
                <!-- field referred by: #msg_l1_fa (local), #msg_l1_g (parent/group) -->
              </${childTag}>

              <${childTag} name="l1_fb">
                <div slot="${msgSlotType}" id="msg_l1_fb"></div>
                <!-- field referred by: #msg_l1_fb (local), #msg_l1_g (parent/group) -->
              </${childTag}>

              <!-- [ INNER FIELDSET ] -->

              <${tag} name="l2_g">
                <${childTag} name="l2_fa">
                  <div slot="${msgSlotType}" id="msg_l2_fa"></div>
                  <!-- field referred by: #msg_l2_fa (local), #msg_l2_g (parent/group), #msg_l1_g (grandparent/group.group) -->
                </${childTag}>

                <${childTag} name="l2_fb">
                  <div slot="${msgSlotType}" id="msg_l2_fb"></div>
                  <!-- field referred by: #msg_l2_fb (local), #msg_l2_g (parent/group), #msg_l1_g (grandparent/group.group) -->
                </${childTag}>

                <div slot="${msgSlotType}" id="msg_l2_g"></div>
                <!-- group referred by: #msg_l2_g (local), #msg_l1_g (parent/group)  -->
              </${tag}>

              <!-- [ / INNER FIELDSET ] -->

              <div slot="${msgSlotType}" id="msg_l1_g"></div>
              <!-- group referred by: #msg_l1_g (local) -->
            </${tag}>
          `));
          return dom;
        };

        // eslint-disable-next-line no-shadow
        childAriaTest = (/** @type {FormGroup} */ childAriaFixture) => {
          /* eslint-disable camelcase */
          // Message elements: all elements pointed at by inputs
          const msg_l1_g = /** @type {FormGroup} */ (childAriaFixture.querySelector('#msg_l1_g'));
          const msg_l1_fa = /** @type {FormChild} */ (childAriaFixture.querySelector('#msg_l1_fa'));
          const msg_l1_fb = /** @type {FormChild} */ (childAriaFixture.querySelector('#msg_l1_fb'));
          const msg_l2_g = /** @type {FormGroup} */ (childAriaFixture.querySelector('#msg_l2_g'));
          const msg_l2_fa = /** @type {FormChild} */ (childAriaFixture.querySelector('#msg_l2_fa'));
          const msg_l2_fb = /** @type {FormChild} */ (childAriaFixture.querySelector('#msg_l2_fb'));

          // Field elements: all inputs pointing to message elements
          const input_l1_fa = /** @type {FormChild} */ (childAriaFixture.querySelector(
            'input[name=l1_fa]',
          ));
          const input_l1_fb = /** @type {FormChild} */ (childAriaFixture.querySelector(
            'input[name=l1_fb]',
          ));
          const input_l2_fa = /** @type {FormChild} */ (childAriaFixture.querySelector(
            'input[name=l2_fa]',
          ));
          const input_l2_fb = /** @type {FormChild} */ (childAriaFixture.querySelector(
            'input[name=l2_fb]',
          ));

          /* eslint-enable camelcase */

          // 'L1' fields (inside lion-fieldset[name="l1_g"]) should point to l1(group) msg
          expect(input_l1_fa.getAttribute('aria-describedby')).to.contain(
            msg_l1_g.id,
            'l1 input(a) refers parent/group',
          );
          expect(input_l1_fb.getAttribute('aria-describedby')).to.contain(
            msg_l1_g.id,
            'l1 input(b) refers parent/group',
          );

          // Also check that aria-describedby of the inputs are not overridden (this relation was
          // put there in lion-input(using lion-field)).
          expect(input_l1_fa.getAttribute('aria-describedby')).to.contain(
            msg_l1_fa.id,
            'l1 input(a) refers local field',
          );
          expect(input_l1_fb.getAttribute('aria-describedby')).to.contain(
            msg_l1_fb.id,
            'l1 input(b) refers local field',
          );

          // Also make feedback element point to nested fieldset inputs
          expect(input_l2_fa.getAttribute('aria-describedby')).to.contain(
            msg_l1_g.id,
            'l2 input(a) refers grandparent/group.group',
          );
          expect(input_l2_fb.getAttribute('aria-describedby')).to.contain(
            msg_l1_g.id,
            'l2 input(b) refers grandparent/group.group',
          );

          // Check order: the nearest ('dom wise': so 1. local, 2. parent, 3. grandparent) message
          // should be read first by screen reader
          const dA = /** @type {string} */ (input_l2_fa.getAttribute('aria-describedby'));
          expect(
            // @ts-expect-error
            dA.indexOf(msg_l2_fa.id) < dA.indexOf(msg_l2_g.id) < dA.indexOf(msg_l1_g.id),
          ).to.equal(true, 'order of ids');
          const dB = input_l2_fb.getAttribute('aria-describedby');
          expect(
            // @ts-expect-error
            dB.indexOf(msg_l2_fb.id) < dB.indexOf(msg_l2_g.id) < dB.indexOf(msg_l1_g.id),
          ).to.equal(true, 'order of ids');
        };
      });

      it(`reads feedback message belonging to fieldset when child input is focused
        (via aria-describedby)`, async () => {
        childAriaTest(await childAriaFixture('feedback'));
      });

      it(`reads help-text message belonging to fieldset when child input is focused
        (via aria-describedby)`, async () => {
        childAriaTest(await childAriaFixture('help-text'));
      });
    });
  });
});

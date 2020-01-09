<tr
  in:receive="{{key: elementID}}"
  out:send="{{key: elementID}}"
  bind:this={element}
  use:useActions={use}
  use:forwardEvents
  class="
    {className}
    {header ? 'mdc-data-table__header-row' : ''}
    {!header ? 'mdc-data-table__row' : ''}
    {(!header && selected) ? 'mdc-data-table__row--selected' : ''}
  "
  {...(selected !== undefined ? {'aria-selected': selected ? 'true' : 'false'} : {})}
  {...exclude($$props, ['use', 'class'])}
><slot></slot></tr>

<script>

  import { fade, crossfade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  import {getContext, setContext} from 'svelte';
  import {current_component} from 'svelte/internal';
  import {forwardEventsBuilder} from '@smui/common/forwardEvents.js';
  import {exclude} from '@smui/common/exclude.js';
  import {useActions} from '@smui/common/useActions.js';

  const forwardEvents = forwardEventsBuilder(current_component);

  export let use = [];
  let className = '';
  let elementID = '';
  export {elementID as id}
  export {className as class};

  let element;
  let header = getContext('SMUI:data-table:row:header');
  let selected = undefined;

  setContext('SMUI:data-table:row:getIndex', getIndex);

  setContext('SMUI:generic:input:setChecked', setChecked);

  function setChecked(checked) {
    selected = checked;
  }

  function getIndex() {
    let i = 0;

    if (element) {
      let el = element;
      while (el.previousSibling) {
        el = el.previousSibling;
        if (el.nodeType === 1) {
          i++;
        }
      }
    }

    return i;
  }

  const [send, receive] = crossfade({
		duration: d => Math.sqrt(d * 200),

		fallback(node, params) {
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;

			return {
				duration: 600,
				easing: quintOut,
				css: t => `
					transform: ${transform} scale(${t});
					opacity: ${t}
				`
			};
		}
	});
</script>
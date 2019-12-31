<script lang="ts">
  import Button, {Label, Icon} from '@smui/button';
  // import { url } from '@sveltech/routify';
  // let x = $url('/test');
  // console.log(x);
  export let value: number = 0;
  export let step: number = 1;
</script>

<div>
  <p class="mdc-typography--body1">
    <slot>Default Counter</slot>
  </p>
  <div>
     <b>
     {value}
     </b>
    <Button on:click={() => (value += step)}><Icon class="material-icons">thumb_up</Icon>+</Button>
    <Button on:click={() => (value -= step)}>-</Button>
  </div>
</div>

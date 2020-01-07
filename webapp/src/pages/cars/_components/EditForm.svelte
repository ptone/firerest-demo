<script>
  import Textfield from '@smui/textfield'
  import Select, {Option} from '@smui/select';
  import Checkbox from '@smui/checkbox';
  import FormField from '@smui/form-field';

  export let item = {
    make: "",
    model: "",
    year: 0,
    body_styles: []
   };

  let years = [];
  for (let i = 1980; i < 2025; i++) {
    years.push(i);
  }

  let bodyStyles = [
    "Sedan",
    "Wagon",
    "Hatchback",
    "Convertible",
    "Coupe",
    "SUV"
  ]

</script>

<Textfield bind:value={item.make} label="Make" />
<Textfield bind:value={item.model} label="Model" />
<br />
<!-- TODO make a select -->
<!-- <Textfield bind:value={item.year} label="year" /> -->
<br />
<Select bind:value={item.year} label="Year">
  {#each years as year}
    <Option value={year} selected={item.year === year}>{year}</Option>
  {/each}
</Select>
<br />
<!-- Body Style checkboxes -->
{#each bodyStyles as style}
  <FormField>
    <Checkbox bind:group={item.body_styles} value={style}/>
    <span slot="label">{style}</span>
  </FormField>
  <br />
{/each}
// Copy buttons: copy the text of the sibling <pre>.
document.querySelectorAll('.copy').forEach(function (button) {
  button.addEventListener('click', async function () {
    var pre = button.parentElement.querySelector('pre');
    if (!pre) return;
    try {
      await navigator.clipboard.writeText(pre.innerText);
      button.textContent = 'Copied';
      button.dataset.done = 'true';
      setTimeout(function () {
        button.textContent = 'Copy';
        delete button.dataset.done;
      }, 1600);
    } catch (e) {
      button.textContent = 'Select and copy';
    }
  });
});

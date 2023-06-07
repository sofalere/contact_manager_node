$(document).ready( () => {
const View = {
  init() {
    this.form = document.querySelector('form');
    this.main = document.querySelector('.main');
    Handlebars.registerHelper('separateTags', (tags) => {
      return tags.split(',').join(', ');
    });
    
    return this;
  },

  updateContacts(contact) {
    if (!Array.isArray(contact)) {
      contact = [contact];
    }
    let context = {contacts: contact};

    let contactTemplate = document.querySelector('#contactList').innerHTML;
    let templateScript = Handlebars.compile(contactTemplate);
    let html = templateScript(context);
    document.querySelector('.list').innerHTML += html;
  },

  bind(action, event, callback) {
    switch(action) {
      case 'openForm':
        document.querySelectorAll('.addContact').forEach(addButton => {
          addButton.addEventListener(event, callback);
        });
        break;
      case 'addContact':
        this.form.addEventListener(event, callback);
        break;
    }
  },

  showForm() {
    this.main.classList.add('hidden');
    this.form.classList.remove('hidden');
  },

  showMain() {
    this.main.classList.remove('hidden');
    this.form.classList.add('hidden');
  },

  clearForm() {
    this.form.reset();
  }
};

const Controller = {
  init() {
    this.view = View.init();
    this.model = Model.init();
    this.bindHanlders();
    this.loadHomePage();
  },

  loadHomePage() {
    this.model.retrieveAll(this.view.updateContacts.bind(this), this.errorMessage.bind(this))
  },

  bindHanlders() {
    let self = this;
    self.view.bind('openForm', 'click', self.openAddContactFormHandler.bind(self));
    self.view.bind('addContact', 'submit', self.submitAddContactHandler.bind(self));

  },

  openAddContactFormHandler() {
    this.view.showForm();
  },

  submitAddContactHandler(e) {
    e.preventDefault();
    const data = new FormData(e.target);
    this.model.addContact(data, this.addNewContact.bind(this), this.errorMessage.bind(this));
  },

  addNewContact(contact) {
    this.view.clearForm();
    this.view.updateContacts(contact)
    this.view.showMain();
  },
  
  errorMessage(message, error) {
    console.log(message, error);
  },
}


const Model = {
  init() {
    return this;
  },

  serialize(data) {
    let json = {};
    for (let pair of data.entries()) {
      if (pair[1] === 'on') {
        json['tags'] = (json['tags']) ? json['tags'] + ',' + pair[0] : pair[0];
      } else {
        json[pair[0]] = pair[1];
      }
    }
    return json;
  },

  addContact: async function(data, resolve, reject) {
    const json = this.serialize(data);

    try {
      const response = await fetch("http://localhost:3000/api/contacts/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(json),
      });
      let newContact = await response.json();
      resolve(newContact);
    } catch (error) {
      reject('Problem processing your request. Please try again.', error);
    }
  },

  retrieveAll: async function(resolve, reject) {
    try {
      const response = await fetch("http://localhost:3000/api/contacts");
      const contacts = await response.json();
      resolve(contacts);
    } catch {
      reject('Problem processing your request. Please try again.', error);
    }
  },
}

Controller.init();

});
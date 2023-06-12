class View {
  constructor(contactManager) {
    this.contactManager = contactManager;
  
    Handlebars.registerHelper('separateTags', (tags) => {
      return tags.split(',').join(', ');
    });
    
    this.renderAll();

    this.form = document.querySelector('form');
    this.main = document.querySelector('.main');
    this.contactToEditID = null;
    
    this.bindEvents();
  }

  alertError(error) {
    alert(error);
  }

  showForm() {
    this.main.classList.add('hidden');
    this.form.classList.remove('hidden');
  }

  showMain() {
    this.form.reset();
    this.contactToEditID = null;
    this.main.classList.remove('hidden');
    this.form.classList.add('hidden');
  }

  getIDByEvent(e) {
    return e.target.parentElement.id;
  }

  findElementByID(id) {
    return document.querySelector(`[id='${id}']`);
  }

  bindEvents() {
    document.querySelectorAll('.addContact').forEach(addButton => {
      addButton.addEventListener('click', this.showForm.bind(this));
    });
    this.form.addEventListener('submit', this.addContactHandler.bind(this));
    document.querySelector('.list').addEventListener('click', this.deleteContactHandler.bind(this));
    document.querySelector('.list').addEventListener('click', this.openEditFormHandler.bind(this));
    document.querySelector('#cancelAdd').addEventListener('click', this.showMain.bind(this));
  }

  renderAll() {
    this.contactManager.retrieveAll(this.displayContacts.bind(this));
  }

  generateHTML(contacts) {
    if (!Array.isArray(contacts)) {
      contacts = [contacts];
    }
    let context = {contacts: contacts};

    let contactTemplate = document.querySelector('#contactList').innerHTML;
    let templateScript = Handlebars.compile(contactTemplate);
    return templateScript(context);
  }

  addContactHandler(e) {
    e.preventDefault();
    const data = new FormData(e.target);

    if (!!this.contactToEditID) {
      this.contactManager.sendContactToEdit(this.displayContactAfterEdit.bind(this), data, this.contactToEditID);
    } else {
      this.contactManager.sendContactToAdd(this.displayContacts.bind(this), data);
    }

    this.contactToEditID = null;
    this.form.reset();
  }

  displayContacts(contacts) {
    const html = this.generateHTML(contacts);
    document.querySelector('.list').innerHTML += html;

    this.showMain();
  }

  displayOneLessContact(id) {
    this.findElementByID(id).remove();
  }

  deleteContactHandler(e) {
    if (e.target.id === 'deleteContact') {
      const id = this.getIDByEvent(e);
      this.contactManager.sendContactToDelete(this.displayOneLessContact.bind(this), id);
    }
  }

  openEditFormHandler(e) {
    if (e.target.id === 'editContact') {
      const id = this.getIDByEvent(e);
      this.contactToEditID = id;
      this.contactManager.retrieveContact(this.displayContactToEdit.bind(this), id);
    }
  }

  displayContactToEdit(response) {
    this.showForm();
    this.form.name = 'Edit Contact';
    
    for (const [key, val] of Object.entries(response)) {
      const input = this.form.elements[key];
      input.value = val;

      if (key === 'tags') {
        const tags = val.split(',');
        tags.forEach(tag => this.form[tag].checked = true);
      }
    }
  }

  displayContactAfterEdit(contact) {
    const element = this.findElementByID(contact[0].id);
    const html = this.generateHTML(contact);

    element.innerHTML = html;
    this.showMain();
  }
};

class Contacts {
  constructor(contactManager) {
    this.contactManager = contactManager;
  }

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
  }

  fromDatabase = async function(url, options, resolve) {
    try {
      const response = await fetch(url, options);
      const contacts = await response.json();
      resolve(contacts);
    } catch (error) {
      return error;
    }
  }

  getAllContacts(resolve) {
    this.fromDatabase("http://localhost:3000/api/contacts", null, resolve)
  }

  getContactByID(resolve, id) {
    id = Number.parseInt(id, 10);
    const url = `http://localhost:3000/api/contacts/${id}`

    this.fromDatabase(url, null, resolve);
  }

  addContact(resolve, data) {
    const json = this.serialize(data);
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    };

    this.fromDatabase("http://localhost:3000/api/contacts/", options, resolve, data)
  }

  editContact(resolve, data, id) {
    const json = this.serialize(data);
    const url = `http://localhost:3000/api/contacts/${id}`
    const options = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    };

    this.fromDatabase(url, options, resolve, json)
  }

  deleteContact = async function(resolve, id) {
    id = Number.parseInt(id, 10);
    const url = `http://localhost:3000/api/contacts/${id}`

    try {
      const response = await fetch(url, { method: 'DELETE'});
      await response.text();
      resolve(id);
    } catch (error) {
      console.log(error);
    }
  }
};

class ContactManager {
  constructor() {
    let self = this;
    this.contacts = new Contacts(self);
    this.view = new View(self);
    this.tagsAndIDs = {};
  }

  retrieveAll(resolve) {
    this.contacts.getAllContacts(resolve);
  }

  retrieveContact(resolve, id) {
    this.contacts.getContactByID(resolve, id);
  }

  storeTags(response) {
    const id = response.id;
    const tags = response.tags.split(',');
    tags.forEach(function(tag) {
        (this.tagsAndIDs[tag]) ? this.tagsAndIDs[tag].push(id) : this.tagsAndIDs[tag] = [id];
    })
  }

  sendContactToAdd(resolve, data) {
    const real = function(response) {
      this.storeTags.call(this);
      resolve(response);
    }
    this.contacts.addContact(real.bind(this), data);
  }

  sendContactToDelete(resolve, id) {
    this.contacts.deleteContact(resolve, id);
    return id;
  }

  sendContactToEdit(resolve, data, id) {
    this.contacts.editContact(resolve, data, id);
    return id;
  }
};


document.addEventListener("DOMContentLoaded", e => {
  new ContactManager();
});
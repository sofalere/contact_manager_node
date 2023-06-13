class View {
  constructor(contactManager) {
    this.contactManager = contactManager;

    Handlebars.registerHelper('separateTagButtons', (tags) => {
      return tags.split(',').map(tag => `<button type="button" value="${tag}"class="tag" name="${tag}">${tag}</button>`).join(', ');
    });

    this.form = document.querySelector('form');
    this.main = document.querySelector('.main');
    this.list = document.querySelector('.list');
    this.contactToEditID = null;
    this.search = document.querySelector('#search');
    
    this.bindEvents();
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
    this.list.addEventListener('click', this.deleteContactHandler.bind(this));
    this.list.addEventListener('click', this.openEditFormHandler.bind(this));
    document.querySelector('#cancelAdd').addEventListener('click', this.showMain.bind(this));
    this.list.addEventListener('click', this.findTagsHanlder.bind(this));
    this.search.addEventListener(this.searchHandler.bind(this));
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
      this.contactManager.sendContactToEdit(data, this.contactToEditID);
    } else {
      this.contactManager.sendContactToAdd(data);
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
      this.contactManager.sendContactToDelete(id);
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
    const element = this.findElementByID(contact.id);
    const html = this.generateHTML(contact);

    element.innerHTML = html;
    this.showMain();
  }

  findTagsHanlder(e) {
    if (e.target.className === 'tag') {
      const tag = e.target.value;
      this.contactManager.retrieveContactsByTag(tag);
    }
  }

  displayContactsWithTags(ids, tag) {
    const contactHeader = document.querySelector("#contact_header");
    contactHeader.innerText = `Contacts with tag ${tag}:`
    
    const button = document.createElement('button');
    button.setAttribute("class", "back_button");
    button.setAttribute("type", "button");
    button.innerText = 'Back';
    contactHeader.appendChild(button);
    
    const contactList = document.querySelectorAll('article');
    contactList.forEach(contact => {
      if (!ids.includes(Number.parseInt(contact.id, 10))) {
        contact.classList.add('hidden');
      }
    });

    button.addEventListener("click", e => {
      e.preventDefault();
      contactHeader.innerText = "Contact List";
      button.remove();
      contactList.forEach(contact => contact.classList.remove('hidden'));
    })
  }

  searchHandler(e) {
    const value = e.input.value;

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
    this.retrieveAllContacts();
  }

  retrieveAllContacts() {
    const self = this;
    const resolve = function(response) {
      response.forEach(contact => self.storeTagPair(contact));
      self.view.displayContacts.bind(self.view)(response);
    }
    this.contacts.getAllContacts(resolve);
  }

  retrieveContact(resolve, id) {
    this.contacts.getContactByID(resolve, id);
  }

  retrieveContactsByTag(tag) {
    const tagIDs = this.tagsAndIDs[tag];
    if (tagIDs) {
      this.view.displayContactsWithTags.call(this.view, tagIDs, tag);
    }
  }

  storeTagPair(contact) {
    const id = contact.id;
    const tags = contact.tags.split(',');
    for(const tag of tags) {
      if (!this.tagsAndIDs[tag]) {
        this.tagsAndIDs[tag] = [id];
      } else if (!this.tagsAndIDs[tag].includes(id)) {
        this.tagsAndIDs[tag].push(id);
      }
    };
  }

  deleteTagPair(id) {
    for(const [tag, IDs] of Object.entries(this.tagsAndIDs)) {
      this.tagsAndIDs[tag] = IDs.filter(_id => _id !== id);

    }
  }

  sendContactToAdd(data) {
    const self = this;
    const resolve = function(response) {
      self.storeTagPair.bind(self)(response);
      self.view.displayContacts.bind(self.view)(response);
    }

    self.contacts.addContact(resolve.bind(self), data);
  }

  sendContactToDelete(id) {
    const self = this;
    const resolve = function(id) {
      self.deleteTagPair.bind(self)(id);
      self.view.displayOneLessContact.bind(self.view)(id);
    }
    self.contacts.deleteContact(resolve, id);
  }

  sendContactToEdit(data, id) {
    const self = this;
    const resolve = function(response) {
      self.storeTagPair.bind(self)(response);
      self.view.displayContactAfterEdit.bind(self.view)(response);
    }
    self.contacts.editContact(resolve, data, id);
  }
};


document.addEventListener("DOMContentLoaded", e => {
  new ContactManager();
});
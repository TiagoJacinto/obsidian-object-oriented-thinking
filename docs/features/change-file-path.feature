Feature: Change file path

Scenario: Changing the file path of a file that doesn't extend another file
Given I a file named "File1" that doesn't extend another file with the given hierarchy ["File1"]
When I rename it to "File2"
Then I should see the object hierarchy as ["File2"]

Scenario: Changing the file path of the parent should update all nested children object hierarchy
Given the files and corresponding object hierarchies:
 | File Name | Object Hierarchy |
 | File3     | [File3]            |
 | File2     | [File3, File2]        |
 | File1     | [File3, File2, File1]    |
When I rename "File2" to "UpdatedFile2"
Then the object hierarchy should be:
 | File Name      | Object Hierarchy |
 | File3          | [File3]            |
 | UpdatedFile2   | [File3, UpdatedFile2]   |
 | File1          | [File3, UpdatedFile2, File1]   |
And "File3" should be extended by "UpdatedFile2"
And "File1" should extend "UpdatedFile2"

Scenario: Changing the file path of the parent should update all children object hierarchy
Given the files and corresponding object hierarchies:
 | File Name | Object Hierarchy  |
 | File1     | [File1]             |
 | File2     | [File1, File2]       |
 | File3     | [File1, File3]       |
When I rename "File1" to "UpdatedFile1"
Then the object hierarchy should be:
 | File Name        | Object Hierarchy    |
 | UpdatedFile1     | [UpdatedFile1]        |
 | File2            | [UpdatedFile1, File2]  |
 | File3            | [UpdatedFile1, File3]  |
